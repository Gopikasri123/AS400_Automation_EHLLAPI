"""Result model and reporting.

Every step of the flow (sign-on, STRSQL, each CRUD step, sign-off) is recorded
as one StepResult. A test case passes only when all of its steps pass.
Reporting is kept separate from execution so a new output format never touches
the automation logic. A run produces a console summary, a CSV, and a
self-contained HTML report.
"""
import csv
import html
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from .logger import get_logger

log = get_logger("results")

PASS, FAIL, SKIP = "PASS", "FAIL", "SKIPPED"


@dataclass
class StepResult:
    test_id: str            # test case id, or SESSION for sign-on / sign-off steps
    step: str               # e.g. "4 CREATE - Insert User"
    statement: str          # SQL or command that was run (may be blank)
    expected: str           # what the step checks for
    actual: str             # what the host showed
    status: str             # PASS | FAIL | SKIPPED
    seconds: float


class ResultCollector:
    def __init__(self, report_dir: str = "reports"):
        self.results: List[StepResult] = []
        self.report_dir = Path(report_dir)
        self.report_dir.mkdir(parents=True, exist_ok=True)

    def add(self, result: StepResult) -> None:
        self.results.append(result)

    # ----------------------------------------------------------- summaries
    def case_status(self) -> Dict[str, str]:
        """test_id -> PASS if every step passed, else FAIL (in run order)."""
        status: Dict[str, str] = {}
        for r in self.results:
            if status.get(r.test_id) != FAIL:
                status[r.test_id] = PASS if r.status == PASS else FAIL
        return status

    def test_cases(self) -> Dict[str, str]:
        """Status of the test-data cases only (SESSION steps excluded)."""
        return {k: v for k, v in self.case_status().items() if k != "SESSION"}

    @property
    def failed(self) -> int:
        """Failed test cases, plus 1 if any SESSION step failed (for the exit code)."""
        status = self.case_status()
        return (sum(1 for s in self.test_cases().values() if s != PASS)
                + (1 if status.get("SESSION", PASS) != PASS else 0))

    def print_summary(self) -> None:
        cases = self.test_cases()
        passed = sum(1 for s in cases.values() if s == PASS)
        session = self.case_status().get("SESSION", PASS)
        print("\n" + "=" * 78)
        print(f"  RESULT SUMMARY    test cases={len(cases)}   passed={passed}   "
              f"failed={len(cases) - passed}   session steps={session}")
        print("=" * 78)
        for r in self.results:
            print(f"  [{r.status:7}] {r.test_id:10} {r.step:34} | {r.actual[:60]}")
        print("=" * 78)

    # --------------------------------------------------------------- files
    def write_csv(self) -> Path:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = self.report_dir / f"results_{stamp}.csv"
        fields = list(StepResult.__dataclass_fields__)
        with path.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=fields)
            writer.writeheader()
            for r in self.results:
                writer.writerow(asdict(r))
        log.info("CSV report:  %s", path)
        return path

    def write_html(self) -> Path:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = self.report_dir / f"report_{stamp}.html"
        colors = {PASS: "#1b7e3c", FAIL: "#b3261e", SKIP: "#8a6d00"}
        cases = self.test_cases()
        passed = sum(1 for s in cases.values() if s == PASS)

        body_rows = []
        for r in self.results:
            body_rows.append(
                "<tr>"
                f"<td>{html.escape(r.test_id)}</td>"
                f"<td>{html.escape(r.step)}</td>"
                f"<td><code>{html.escape(r.statement)}</code></td>"
                f"<td>{html.escape(r.expected)}</td>"
                f"<td>{html.escape(r.actual)}</td>"
                f"<td style='color:{colors.get(r.status, '#444')};font-weight:600'>"
                f"{html.escape(r.status)}</td>"
                f"<td>{r.seconds:.2f}s</td>"
                "</tr>"
            )

        doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>PUB400 USERS CRUD Report</title>
<style>
 body{{font-family:'Segoe UI',Arial,sans-serif;margin:2rem;color:#1a1a1a}}
 h1{{font-size:1.3rem;margin-bottom:.2rem}}
 .meta{{color:#555;margin-bottom:1rem}}
 .pill{{display:inline-block;padding:.1rem .55rem;border-radius:.5rem;
        color:#fff;font-weight:600;margin-right:.4rem}}
 table{{border-collapse:collapse;width:100%;font-size:.88rem}}
 th,td{{border:1px solid #ddd;padding:.45rem .6rem;text-align:left;vertical-align:top}}
 th{{background:#f3f3f3}}
 code{{white-space:pre-wrap;word-break:break-word}}
</style></head><body>
<h1>PUB400 USERS CRUD Report</h1>
<div class="meta">Generated {datetime.now():%Y-%m-%d %H:%M:%S}
 &nbsp;
 <span class="pill" style="background:#444">test cases {len(cases)}</span>
 <span class="pill" style="background:#1b7e3c">passed {passed}</span>
 <span class="pill" style="background:#b3261e">failed {len(cases) - passed}</span>
</div>
<table><thead><tr>
 <th>Test ID</th><th>Step</th><th>Statement</th><th>Expected</th>
 <th>Actual</th><th>Status</th><th>Time</th>
</tr></thead><tbody>
{''.join(body_rows)}
</tbody></table>
</body></html>"""
        path.write_text(doc, encoding="utf-8")
        log.info("HTML report: %s", path)
        return path
