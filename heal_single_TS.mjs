#!/usr/bin/env node
// Self-healing Playwright loop — PER-TEST mode.
//
// Old flow:  run whole suite -> heal all locator failures -> rerun whole suite
// New flow:  for each test, one at a time:
//              run it -> if it fails on a locator -> heal -> rerun THAT test
//              (retrying up to MAX_RETRIES) -> then move on to the next test
//
// IMPORTANT: a single `npx playwright test` process always runs to completion;
// it can't be paused mid-run, healed, and resumed from where it left off.
// To get "heal immediately, then continue" behaviour, this script instead runs
// Playwright ONCE PER TEST (scoped with --grep), so each test is its own run.
// This trades away Playwright's parallel workers for per-test control — tests
// now execute sequentially instead of in parallel.
//
// Usage:  node heal.mjs
// Requires: Playwright JSON reporter writing to RESULTS_FILE (see playwright.config).
//           The app under test running at http://localhost:5501 (or a webServer config).
//           Claude Code CLI installed and authenticated.

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

// ---------------------------- config ----------------------------
const MAX_RETRIES = 3; // heal attempts per individual test
const RESULTS_FILE = "test-results/results.json";
const MAX_TURNS = 30; // cap Claude Code's agentic turns per heal

const SELECTOR_PATTERNS = [
  /waiting for (locator|getBy\w+)\(/i,
  /resolved to 0 elements/i,
  /strict mode violation/i,
  /locator\.\w+: Timeout/i,
  /element is not attached to the DOM/i,
  /no element matches selector/i,
];
// ----------------------------------------------------------------

const isWin = process.platform === "win32";

// Playwright is started as `node <cli.js> ...` WITHOUT a shell, so every argument reaches it exactly as
// written. (Through cmd.exe, characters in test titles such as "|", "&", "^" and spaces were read as
// shell syntax: "|" became a pipe, which broke Playwright's output with EPIPE.)
const PLAYWRIGHT_CLI = "node_modules/@playwright/test/cli.js";
const runPlaywright = (args, options) => spawnSync(process.execPath, [PLAYWRIGHT_CLI, ...args], options);

// Extra argv passed after `npm run heal --` (e.g. a spec file or --grep pattern),
// so healing also works when scoped to a single test script instead of the full suite.
const EXTRA_ARGS = process.argv.slice(2);

// Ask Playwright for the full test list (no execution) so we know what to loop over.
function listTests() {
  const args = ["test", "--list", "--reporter=json", ...EXTRA_ARGS];
  console.log(`\n📋 playwright ${args.join(" ")}`);
  const r = runPlaywright(args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout) {
    console.error("🛑 Could not list tests. Aborting.");
    process.exit(1);
  }
  let report;
  try {
    report = JSON.parse(r.stdout);
  } catch {
    console.error("🛑 Could not parse test list JSON. Aborting.");
    process.exit(1);
  }
  const tests = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) tests.push({ file: spec.file, line: spec.line, title: spec.title });
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const s of report.suites ?? []) walk(s);
  return tests;
}

// Run exactly ONE test, selected by "file:line" from the test list (no title regex to escape),
// and write results to RESULTS_FILE.
function runOneTest(file, line) {
  const args = ["test", `${file}:${line}`];
  console.log(`\n▶ playwright ${args.join(" ")}`);
  const r = runPlaywright(args, {
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_HTML_OPEN: "never" },
  });
  return r.status === 0;
}

// Walk the Playwright JSON report and collect failing specs + their error text.
function collectFailures() {
  if (!existsSync(RESULTS_FILE)) return [];
  let report;
  try {
    report = JSON.parse(readFileSync(RESULTS_FILE, "utf8"));
  } catch {
    return [];
  }
  const failures = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      if (spec.ok) continue;
      const errors = [];
      for (const t of spec.tests ?? [])
        for (const res of t.results ?? [])
          for (const e of res.errors ?? []) if (e.message) errors.push(e.message);
      failures.push({ file: spec.file, title: spec.title, errors });
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const s of report.suites ?? []) walk(s);
  return failures;
}

const isSelectorFailure = (errors) =>
  errors.some((msg) => SELECTOR_PATTERNS.some((re) => re.test(msg)));

// Look up this specific test's failure info from the just-written results file.
function getFailureFor(file, title) {
  return collectFailures().find((f) => f.file === file && f.title === title) ?? null;
}

function invokeClaudeHeal(failures) {
  const list = failures.map((f) => `- ${f.file} › ${f.title}`).join("\n");
  const prompt = [
    "Playwright tests are failing because source locators changed.",
    `Read CLAUDE.md and the JSON report at ${RESULTS_FILE}, then heal ONLY the`,
    "selector-resolution failures per that playbook. Do not touch assertions,",
    "test logic, or app source. Edit locators in page objects, prefer",
    "getByRole/getByTestId. Find the new locator by reading the current SOURCE",
    "(the changed element is there) and grepping for it; only open the live DOM via",
    "Playwright MCP if the app hashes/transforms class names at build time. Append a",
    "heal-report.md entry per fix. Failing tests:",
    list,
  ].join(" ");

  console.log("\n🩹 Invoking Claude Code to heal this locator…");
  const r = spawnSync(
    "claude",
    [
      "-p",
      "--add-dir", "..",
      "--allowedTools", "Bash(grep*),Read,Edit",
      "--permission-mode", "acceptEdits",
      "--max-turns", String(MAX_TURNS),
    ],
    { input: prompt, stdio: ["pipe", "inherit", "inherit"], shell: isWin }
  );
  return r.status === 0;
}

// ------------------------------ per-test loop ------------------------------
console.log("📋 Listing tests…");
const tests = listTests();
console.log(`Found ${tests.length} test(s).`);

let anyEscalated = false;

for (const t of tests) {
  console.log(`\n=== ${t.file} › ${t.title} ===`);

  if (runOneTest(t.file, t.line)) {
    console.log(`✅ Passed: ${t.file} › ${t.title}`);
    continue; // move straight to the next test
  }

  let failure = getFailureFor(t.file, t.title);
  if (!failure) {
    console.log("⚠ Could not read failure details for this test. Skipping heal, moving on.");
    anyEscalated = true;
    continue;
  }

  if (!isSelectorFailure(failure.errors)) {
    console.log(`⚠ Non-locator failure — likely a real bug. Not healing: ${t.file} › ${t.title}`);
    anyEscalated = true;
    continue; // move to next test without healing
  }

  let healed = false;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`\n— Heal attempt ${attempt}/${MAX_RETRIES} for this test —`);
    invokeClaudeHeal([failure]);

    if (runOneTest(t.file, t.line)) {
      console.log(`✅ Healed and passing: ${t.file} › ${t.title}`);
      healed = true;
      break;
    }

    failure = getFailureFor(t.file, t.title);
    if (!failure || !isSelectorFailure(failure.errors)) {
      // either info is missing, or it's no longer a selector-type failure
      // (e.g. it now fails on an assertion) — stop retrying, flag it.
      break;
    }
  }

  if (!healed) {
    console.log(`🛑 Still failing after retries: ${t.file} › ${t.title}. Escalating to a human.`);
    anyEscalated = true;
  }
  // either way, continue on to the next test in the suite
}

if (anyEscalated) {
  console.log("\n🛑 Some tests still need human attention. See heal-report.md and the log above.");
  process.exit(1);
} else {
  console.log("\n✅ All tests passed (healing applied where needed).");
  process.exit(0);
}
