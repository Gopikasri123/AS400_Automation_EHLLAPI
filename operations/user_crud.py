"""USERS lifecycle: steps 3-9 of the test flow for one test-data row.

    3  Verify the table is accessible and the test USER_ID is not there yet
    4  CREATE  INSERT the user
    5  READ    SELECT it back and verify every field
    6  UPDATE  change the fields given as update_<column> in the test data
    7  READ    verify updated fields changed and the others did not
    8  DELETE  remove the user
    9  READ    verify the record no longer exists

Test-data columns: ``user_id, user_name, email, city, phone`` map to the table
columns of the same name; ``update_<column>`` holds the new value for step 6.
If the USER_ID already exists the case is skipped, so existing data is never
changed.

Operations can be run on their own (``run_crud.py --only add``): add = steps
4-5 and leaves the row in place; update = 6-7 and delete = 8-9 then need that
row to exist already.
"""
import time
from typing import Dict, List, Optional

from framework.logger import get_logger
from framework.results import FAIL, PASS, SKIP, ResultCollector, StepResult
from framework.strsql import SqlResult, StrSql

log = get_logger("users")

META = ("test_id", "run", "description")
OPERATIONS = ("add", "update", "delete")
LATER_STEPS = ("4 CREATE - Insert User", "5 READ - Verify User",
               "6 UPDATE - Modify User", "7 READ - Verify Updated Data",
               "8 DELETE - Remove User", "9 READ - Verify Deletion")


class UserCrudFlow:
    def __init__(self, sql: StrSql, table: str, key_column: str,
                 numeric_columns: List[str], collector: ResultCollector):
        self.sql = sql
        self.table = table
        self.key = key_column.upper()
        self.numeric = {c.upper() for c in numeric_columns}
        self.collector = collector

    # --------------------------------------------------------------- flow
    def run(self, case: Dict[str, str], ops=OPERATIONS) -> None:
        """Run steps 3-9; ``ops`` limits it to some of add / update / delete."""
        self.test_id = case.get("test_id", "?")
        values = {k.upper(): v for k, v in case.items()
                  if k not in META and not k.startswith("update_")}
        updates = {k[len("update_"):].upper(): v for k, v in case.items()
                   if k.startswith("update_") and v != ""}
        columns = list(values)
        key_value = values[self.key]
        where = f"WHERE {self.key} = {self._literal(self.key, key_value)}"
        select = f"SELECT {', '.join(columns)} FROM {self.table} {where}"
        log.info("==== %s: %s ====", self.test_id, case.get("description", ""))

        # 3 - table accessible + initial state
        res = self._run(f"SELECT COUNT(*) FROM {self.table}")
        count = res.rows[0].get("COUNT ( * )") if res.rows else None
        self._record("3 Verify USERS table", res, "table accessible (SELECT runs)",
                     f"accessible, {count} row(s)" if res.rows else res.message,
                     bool(res.rows))
        # ADD needs the USER_ID to be free; UPDATE / DELETE on their own need the
        # row to exist already (e.g. left behind by an earlier '--only add' run).
        res = self._run(select)
        exists = bool(res.rows)
        if "add" in ops:
            ready, want = not exists, f"no row with {self.key} {key_value}"
            why = f"skipped: {self.key} {key_value} already exists"
        else:
            ready, want = exists, f"a row with {self.key} {key_value}"
            why = f"skipped: {self.key} {key_value} does not exist - run --only add first"
        self._record("3 Verify initial state", res, want,
                     self._describe(res) if exists else "no row found", ready)
        if not ready:
            for step in LATER_STEPS:
                self._add(step, "", "", why, SKIP, 0.0)
            return

        if "add" in ops:
            # 4 - CREATE
            cols = ", ".join(columns)
            vals = ", ".join(self._literal(c, values[c]) for c in columns)
            res = self._run(f"INSERT INTO {self.table} ({cols}) VALUES ({vals})")
            self._record("4 CREATE - Insert User", res, "1 rows inserted",
                         res.message, "1 rows inserted" in res.message)

            # 5 - READ after create
            self._verify_fields("5 READ - Verify User", select, values, {})

        # 6 - UPDATE
        if "update" not in ops:
            pass
        elif updates:
            sets = ", ".join(f"{c} = {self._literal(c, v)}" for c, v in updates.items())
            res = self._run(f"UPDATE {self.table} SET {sets} {where}")
            self._record("6 UPDATE - Modify User", res, "1 rows updated",
                         res.message, "1 rows updated" in res.message)
            # 7 - READ after update
            self._verify_fields("7 READ - Verify Updated Data", select,
                                {**values, **updates}, updates)
        else:
            for step in LATER_STEPS[2:4]:
                self._add(step, "", "", "skipped: no update_<column> values in test data",
                          SKIP, 0.0)

        if "delete" not in ops:
            return

        # 8 - DELETE
        res = self._run(f"DELETE FROM {self.table} {where}")
        self._record("8 DELETE - Remove User", res, "1 rows deleted",
                     res.message, "1 rows deleted" in res.message)

        # 9 - READ after delete
        res = self._run(select)
        gone = res.rows == []
        self._record("9 READ - Verify Deletion", res, "no record found",
                     "no record found" if gone else self._describe(res), gone)

    # ------------------------------------------------------------ helpers
    def _verify_fields(self, step: str, select: str, expected: Dict[str, str],
                       updated: Dict[str, str]) -> None:
        res = self._run(select)
        if not res.rows or len(res.rows) != 1:
            self._record(step, res, "exactly 1 row", self._describe(res), False)
            return
        row = {k.upper(): v for k, v in res.rows[0].items()}
        self._record(step, res, "1 row displayed", "1 row displayed", True)
        for column, want in expected.items():
            got = row.get(column)
            tag = " (updated)" if column in updated else (" (unchanged)" if updated else "")
            ok = self._same(column, want, got)
            self._add(f"{step[:6]} - {column}{tag}", "", want or "NULL",
                      "NULL" if got is None else got, PASS if ok else FAIL, 0.0)

    def _same(self, column: str, want: str, got: Optional[str]) -> bool:
        if want == "":
            return got is None or got == ""
        if got is None:
            return False
        if column in self.numeric:            # PUB400 shows 9001 as '9.001'
            strip = lambda v: v.replace(".", "").replace(",", "").replace(" ", "")
            return strip(want) == strip(got)
        return want == got

    def _literal(self, column: str, value: str) -> str:
        if value == "":
            return "NULL"
        if column in self.numeric:
            return value
        return "'" + value.replace("'", "''") + "'"

    @staticmethod
    def _describe(res: SqlResult) -> str:
        if res.rows is None:
            return res.message
        return f"{len(res.rows)} row(s): {res.rows}"

    def _run(self, statement: str) -> SqlResult:
        self._started = time.time()
        return self.sql.execute(statement)

    def _record(self, step: str, res: SqlResult, expected: str, actual: str,
                ok: bool) -> None:
        self._add(step, res.statement, expected, actual, PASS if ok else FAIL,
                  time.time() - self._started)

    def _add(self, step, statement, expected, actual, status, seconds) -> None:
        log.info("[%s] %s | %s | %s", status, self.test_id, step, actual)
        self.collector.add(StepResult(self.test_id, step, statement, expected,
                                      actual, status, seconds))
