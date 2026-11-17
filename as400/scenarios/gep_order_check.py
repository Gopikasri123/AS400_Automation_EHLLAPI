#!/usr/bin/env python
"""
GEP order -> AS400 ORDERS table check, plus a Main Menu scrape.

Called by the Playwright test tests/cross_platform/GEP2-36899_AS400.spec.ts after
it has placed an order on the GEP website. The GEP website is not connected to
PUB400, so this scenario records the website order in the ORDERS table itself
(simulating the back-end feed) and then reads it back on the green screen.

    A1  Open the ACS session, sign on, verify the IBM i Main Menu
    A2  Start STRSQL
    A3  Make sure <library>.ORDERS exists (created on the first run)
    A4  Verify the order number is not in ORDERS yet
    A5  INSERT the website order (ORDER_ID, PRODUCT_ID, ORDER_STATUS, ORDER_DATE)
    A6  SELECT it back on the 'Display Data' screen and verify every field
    A7  Exit STRSQL back to the Main Menu
    A8  Scrape the text of a Main Menu option (default option 1)
    A9  Sign off (and close the emulator if config says so)

Run from the as400 folder:
    python -m scenarios.gep_order_check --order 1234567 --product 1127081 \
        --status Processing --order-date 2026-11-17 --menu-option 1 --out result.json

The result JSON (--out) holds every step, the row read from ORDERS and the
scraped menu text. Exit code 0 only when every step passed.
"""
import argparse
import json
import re
import sys
import time
from datetime import date
from typing import Dict, List, Optional

from as400_ehllapi.config import load_config
from as400_ehllapi.logger import setup_logging
from as400_ehllapi.results import FAIL, PASS, ResultCollector, StepResult
from as400_ehllapi.strsql import SqlResult, StrSql
from as400_ehllapi.terminal import Terminal

TEST_ID = "GEP2-36899"
ORDERS_TABLE = "ORDERS"
# Layout of <library>.ORDERS (used only to create the table when it does not exist yet).
ORDERS_COLUMNS = {
    "ORDER_ID": "VARCHAR(20) NOT NULL",
    "PRODUCT_ID": "VARCHAR(30) NOT NULL",
    "ORDER_STATUS": "VARCHAR(20)",
    "ORDER_DATE": "DATE",
}
ORDERS_KEY = "ORDER_ID"
STATUS_MAX = 20                      # ORDER_STATUS is VARCHAR(20)
NUMERIC: set = set()
MENU_OPTION = re.compile(r"^\s*(\d{1,2})\.\s+(\S.*?)\s*$")


def parse_args():
    p = argparse.ArgumentParser(description="GEP order -> AS400 ORDERS check + Main Menu scrape")
    p.add_argument("--config", default="config/config.ini")
    p.add_argument("--order", required=True, help="order number placed on the website (ORDER_ID)")
    p.add_argument("--product", required=True, help="product ID ordered (PRODUCT_ID)")
    p.add_argument("--status", default="", help="order status (ORDER_STATUS, max 20 characters)")
    p.add_argument("--order-date", default=date.today().isoformat(),
                   help="order date YYYY-MM-DD (ORDER_DATE, default today)")
    p.add_argument("--menu-option", type=int, default=1, help="Main Menu option to scrape")
    p.add_argument("--out", default="reports/gep_order_check.json", help="result JSON file")
    p.add_argument("--keep-open", action="store_true", help="leave the emulator open")
    return p.parse_args()


class Scenario:
    def __init__(self, args, cfg, log):
        self.args, self.cfg, self.log = args, cfg, log
        self.collector = ResultCollector(cfg.report_dir)
        self.terminal = Terminal(cfg)
        self.sql = StrSql(self.terminal)
        self.table = f"{cfg.library}.{ORDERS_TABLE}"
        self.order_row: Optional[Dict[str, Optional[str]]] = None
        self.menu: Dict[str, object] = {}

    # ------------------------------------------------------------ recording
    def step(self, name: str, expected: str, action, statement: str = "") -> bool:
        """Run one step; the action returns (ok, actual) or raises."""
        started = time.time()
        try:
            ok, actual = action()
        except Exception as exc:                       # a failed step never hides the next ones
            ok, actual = False, f"{type(exc).__name__}: {exc}"
        status = PASS if ok else FAIL
        self.log.info("[%s] %s | %s | %s", status, TEST_ID, name, actual)
        self.collector.add(StepResult(TEST_ID, name, statement, expected, str(actual),
                                      status, time.time() - started))
        return ok

    # ---------------------------------------------------------------- flow
    def run(self) -> None:
        a = self.args
        values = {"ORDER_ID": a.order, "PRODUCT_ID": a.product,
                  "ORDER_STATUS": a.status[:STATUS_MAX], "ORDER_DATE": a.order_date}
        where = f"WHERE {ORDERS_KEY} = {self.literal(ORDERS_KEY, a.order)}"
        # The date is shown in ISO form so it reads the same whatever the job's date format is.
        shown = [f"CHAR({c}, ISO) AS {c}" if c == "ORDER_DATE" else c for c in values]
        select = f"SELECT {', '.join(shown)} FROM {self.table} {where}"
        try:
            if not self.step("A1 Open session and sign on", "IBM i Main Menu displayed",
                             self.sign_on):
                return
            if self.step("A2 Start STRSQL", "Enter SQL Statements prompt", self.open_sql):
                (self.step("A3 ORDERS table available", f"{self.table} exists",
                           self.ensure_table)
                 and self.step("A4 Order not in ORDERS yet", f"no row with {ORDERS_KEY} {a.order}",
                               lambda: self.not_present(select), select)
                 and self.step("A5 Insert website order", "1 rows inserted",
                               lambda: self.insert(values), self.insert_sql(values))
                 and self.step("A6 Verify order in ORDERS", "1 row, every field matches",
                               lambda: self.verify(select, values), select))
                self.step("A7 Exit STRSQL", "back on the Main Menu", self.close_sql)
            self.step(f"A8 Scrape Main Menu option {a.menu_option}",
                      f"text of option {a.menu_option}", self.scrape_menu)
            self.step("A9 Sign off", "sign-on screen displayed", self.sign_off)
            if self.cfg.close_emulator and not a.keep_open:
                self.step("A9 Close emulator", "session disconnected", self.close_emulator)
        finally:
            self.terminal.close()

    # --------------------------------------------------------------- steps
    def sign_on(self):
        self.terminal.open()
        self.terminal.sign_on()
        self.terminal.to_main_menu()
        return True, "IBM i Main Menu displayed"

    def open_sql(self):
        self.sql.open()
        return True, "Enter SQL Statements prompt"

    def ensure_table(self):
        res = self.sql.execute(f"SELECT COUNT(*) FROM {self.table}")
        if res.rows is not None:
            return True, f"{self.table} exists, {res.rows[0].get('COUNT ( * )')} row(s)"
        cols = ", ".join(f"{c} {t}" for c, t in ORDERS_COLUMNS.items())
        res = self.sql.execute(f"CREATE TABLE {self.table} ({cols}, PRIMARY KEY ({ORDERS_KEY}))")
        return "created" in res.message.lower(), f"created on this run: {res.message}"

    def not_present(self, select: str):
        res = self.sql.execute(select)
        if res.rows is None:
            return False, res.message
        return res.rows == [], ("no row found" if not res.rows else
                                f"order already in {self.table}: {res.rows}")

    def insert_sql(self, values: Dict[str, str]) -> str:
        cols = ", ".join(values)
        vals = ", ".join(self.literal(c, v) for c, v in values.items())
        return f"INSERT INTO {self.table} ({cols}) VALUES ({vals})"

    def insert(self, values: Dict[str, str]):
        res = self.sql.execute(self.insert_sql(values))
        return "1 rows inserted" in res.message, res.message

    def verify(self, select: str, expected: Dict[str, str]):
        res: SqlResult = self.sql.execute(select)
        if not res.rows or len(res.rows) != 1:
            return False, res.message if res.rows is None else f"{len(res.rows)} row(s)"
        row = {k.upper(): v for k, v in res.rows[0].items()}
        self.order_row = row
        wrong = [f"{c}: expected '{w}', screen shows '{row.get(c)}'"
                 for c, w in expected.items() if not self.same(c, w, row.get(c))]
        return not wrong, "; ".join(wrong) or f"1 row on screen: {row}"

    def close_sql(self):
        self.sql.close()
        self.terminal.to_main_menu()
        return True, "Main Menu displayed"

    def scrape_menu(self):
        self.terminal.to_main_menu()
        rows: List[str] = self.terminal.session.screen_rows()
        options = {}
        for row in rows:
            m = MENU_OPTION.match(row)
            if m:
                options[int(m.group(1))] = m.group(2)
        title = next((r.strip() for r in rows if "Main Menu" in r), "")
        text = options.get(self.args.menu_option, "")
        self.menu = {"option": self.args.menu_option, "text": text, "title": title,
                     "all_options": {str(k): v for k, v in sorted(options.items())},
                     "screen": rows}
        if not text:
            return False, f"option {self.args.menu_option} not found; options seen: {options}"
        return True, f"option {self.args.menu_option} = '{text}'"

    def sign_off(self):
        self.terminal.sign_off()
        return True, "sign-on screen displayed"

    def close_emulator(self):
        self.terminal.close_emulator()
        return True, "session disconnected"

    # ------------------------------------------------------------- helpers
    @staticmethod
    def literal(column: str, value: str) -> str:
        if value == "":
            return "NULL"
        if column in NUMERIC:
            return str(int(value))
        return "'" + value.replace("'", "''") + "'"

    @staticmethod
    def same(column: str, want: str, got: Optional[str]) -> bool:
        if want == "":
            return got in (None, "")
        if got is None:
            return False
        if column in NUMERIC:                     # PUB400 shows 1000 as '1.000'
            strip = lambda v: re.sub(r"[.,\s]", "", v)
            return strip(want) == strip(got)
        return want.strip() == got.strip()


def main() -> None:
    args = parse_args()
    cfg = load_config(args.config)
    log = setup_logging(cfg.report_dir)
    log.info("GEP order %s -> %s.%s on %s as %s", args.order, cfg.library, ORDERS_TABLE,
             cfg.host, cfg.user)

    scenario = Scenario(args, cfg, log)
    scenario.run()

    c = scenario.collector
    c.print_summary()
    csv_path, html_path = c.write_csv(), c.write_html()
    passed = all(r.status == PASS for r in c.results)
    result = {
        "passed": passed,
        "table": scenario.table,
        "order": scenario.order_row,
        "menu": scenario.menu,
        "steps": [{"step": r.step, "status": r.status, "expected": r.expected,
                   "actual": r.actual, "statement": r.statement} for r in c.results],
        "reports": {"csv": str(csv_path.resolve()), "html": str(html_path.resolve())},
    }
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    log.info("Result JSON: %s", args.out)
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
