// npm run report: opens the HTML report of the newest run (reports/GEP_Report_<YYYY-MM-DD>_<HH-mm-ss>).
// npm run report -- <folder name>: opens that run instead, e.g. npm run report -- GEP_Report_2026-11-04_15-33-00
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = "reports";
const PREFIX = "GEP_Report_";
// The date stamp sorts in time order, so the last folder is the newest run.
const runs = fs.existsSync(ROOT)
  ? fs
      .readdirSync(ROOT)
      .filter((name) => name.startsWith(PREFIX) && fs.existsSync(path.join(ROOT, name, "html", "index.html")))
      .sort()
  : [];
if (!runs.length) {
  console.error(`No ${ROOT}/${PREFIX}<date>_<time> report folders found. Run the tests first.`);
  process.exit(1);
}

const run = process.argv[2] ?? runs.at(-1);
console.log(`Opening ${ROOT}/${run}/html (Monocart: ${ROOT}/${run}/monocart/index.html)`);
const result = spawnSync("npx", ["playwright", "show-report", path.join(ROOT, run, "html")], { stdio: "inherit", shell: true });
process.exit(result.status ?? 0);
