#!/usr/bin/env python
"""
PUB400 USERS CRUD automation - runner.

Runs the end-to-end flow on a visible ACS 5250 session, driven by the test data
management file (config [runtime] test_data, default data/users_testdata.csv):

     1  Open the saved session (A.hod), sign on, verify the IBM i Main Menu
     2  From the Main Menu start STRSQL and wait for the SQL prompt
   3-9  For each test-data row with run=Y: verify table, INSERT, SELECT and
        verify fields, UPDATE, verify, DELETE, verify deletion
    10  Exit STRSQL back to the Main Menu
    11  Sign off, verify the sign-on screen, close the emulator

Every step is recorded; the run produces console + CSV + HTML reports.

Prerequisites
-------------
* ACS 5250 session to PUB400 saved as a .hod file (default Desktop/A.hod, see
  [launch] in config.ini), or already open. Its short name must match config
  (default 'A').
* 64-bit Python with the ACS EHLLAPI bridge installed.

Usage
-----
    python run_crud.py                      run every test-data row with run=Y
    python run_crud.py --only add           only INSERT + verify (row is kept)
    python run_crud.py --only delete        only DELETE + verify (row must exist)
    python run_crud.py --case TC_USR_01     run only this test case (repeatable)
    python run_crud.py --data other.csv     use another test data file
    python run_crud.py --slowmo 2 --trace   watch mode (see each action)
    python run_crud.py --fast               full speed, minimal logging
    python run_crud.py --keep-open          do not close the emulator at the end
"""
import argparse
import sys
import time

from framework.config import load_config
from framework.csv_loader import load_cases
from framework.logger import setup_logging
from framework.results import FAIL, PASS, ResultCollector, StepResult
from framework.strsql import StrSql
from framework.terminal import Terminal
from operations.user_crud import OPERATIONS, UserCrudFlow

SESSION = "SESSION"


def parse_args():
    p = argparse.ArgumentParser(description="PUB400 USERS CRUD automation")
    p.add_argument("--config", default="config/config.ini")
    p.add_argument("--data", help="test data file (overrides config test_data)")
    p.add_argument("--only", choices=OPERATIONS, action="append",
                   help="run only this operation (repeatable); default runs "
                        "add, update and delete")
    p.add_argument("--case", action="append", metavar="TEST_ID",
                   help="run only this test case (repeatable)")
    p.add_argument("--slowmo", type=float, help="override seconds paused per action")
    p.add_argument("--trace", dest="trace", action="store_true", default=None,
                   help="print a play-by-play of every action")
    p.add_argument("--no-trace", dest="trace", action="store_false")
    p.add_argument("--fast", action="store_true", help="--slowmo 0 and no trace")
    p.add_argument("--keep-open", action="store_true",
                   help="leave the emulator open after signing off")
    return p.parse_args()


def session_step(collector, log, step, expected, action) -> bool:
    """Run one session-level step (1, 2, 10, 11) and record PASS / FAIL."""
    started = time.time()
    try:
        actual = action() or expected
        status = PASS
    except Exception as exc:
        actual, status = str(exc), FAIL
    log.info("[%s] %s | %s | %s", status, SESSION, step, actual)
    collector.add(StepResult(SESSION, step, "", expected, actual, status,
                             time.time() - started))
    return status == PASS


def main() -> None:
    args = parse_args()
    cfg = load_config(args.config)

    # CLI overrides on top of config
    if args.fast:
        cfg.slowmo, cfg.trace = 0.0, False
    if args.slowmo is not None:
        cfg.slowmo = args.slowmo
    if args.trace is not None:
        cfg.trace = args.trace

    log = setup_logging(cfg.report_dir)
    log.info("Target %s on %s as %s (session %s)",
             cfg.qualified_table, cfg.host, cfg.user, cfg.session)

    cases = load_cases(args.data or f"{cfg.data_dir}/{cfg.test_data}")
    cases = [c for c in cases if c.get("run", "Y").upper() != "N"]
    if args.case:
        cases = [c for c in cases if c.get("test_id") in args.case]
    log.info("%d test case(s) selected", len(cases))

    collector = ResultCollector(cfg.report_dir)
    terminal = Terminal(cfg)
    sql = StrSql(terminal)

    def open_and_sign_on():
        terminal.open()
        terminal.sign_on()
        terminal.to_main_menu()
        return "IBM i Main Menu displayed"

    try:
        if session_step(collector, log, "1 Open session and sign on",
                        "IBM i Main Menu displayed", open_and_sign_on) and \
           session_step(collector, log, "2 Navigate to SQL (STRSQL)",
                        "Enter SQL Statements prompt", lambda: sql.open()):
            flow = UserCrudFlow(sql, cfg.qualified_table, cfg.key_column,
                                cfg.numeric_columns, collector)
            for case in cases:
                try:
                    flow.run(case, args.only or OPERATIONS)
                except Exception as exc:          # keep going with the next case
                    collector.add(StepResult(case.get("test_id", "?"), "aborted", "",
                                             "case completes", str(exc), FAIL, 0.0))
                    log.error("Case %s aborted: %s", case.get("test_id"), exc)

            session_step(collector, log, "10 Exit SQL", "back on the Main Menu",
                         lambda: sql.close())
        session_step(collector, log, "11 Sign off", "sign-on screen displayed",
                     terminal.sign_off)
        if cfg.close_emulator and not args.keep_open:
            session_step(collector, log, "11 Close emulator", "session disconnected",
                         terminal.close_emulator)
    finally:
        terminal.close()

    collector.print_summary()
    collector.write_csv()
    collector.write_html()
    sys.exit(0 if collector.failed == 0 else 1)   # non-zero exit fails a CI job


if __name__ == "__main__":
    main()
