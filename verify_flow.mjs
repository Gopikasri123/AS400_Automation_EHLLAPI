#!/usr/bin/env node
// Loop 2 — flow fidelity check: does the Playwright code follow the manual test case, step by step?
//
// For every manual test case in manual-test-cases/ (or the ones matching the filter):
//   Check A (script, no AI): every manual step is covered by a `test.step('Step N: …')` (or a step range),
//            in the same order, with no extra steps; merged / uncoded steps need a `// @flow-deviation` reason.
//   Check B (AI reviewer, read-only): for each step, the code does the manual Action with the same Test data
//            and asserts the Expected result.
//   Any problem → AI fixer edits the spec / page objects / data (never the manual test case) → typecheck →
//   check A and B again. Up to MAX_ATTEMPTS fixes; stops early when the same problems come back.
//   Result → flow-check-report.md, and review-needed/<manual test case>.md for anything left unresolved.
//
// Linking and markers (see CLAUDE.md):
//   // @manual manual-test-cases/<file>.md         in the spec, above the test(s) it applies to
//   // @flow-deviation <step or a-b>: <reason>     right above a merged step range, or where an uncoded step would be
//
// Usage:  node verify_flow.mjs [filter ...] [--no-ai] [--no-fix] [--runtime]
//   filter      part of a manual test case file name, e.g. TC01
//   --no-ai     check A only (no Claude calls)
//   --no-fix    report problems, do not try to fix them
//   --runtime   also compare the steps that actually ran (test-results/results.json) with the manual test case
// Requires: Claude Code CLI (`claude`) installed and logged in, unless --no-ai.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// ---------------------------- config ----------------------------
const MAX_ATTEMPTS = 3; // fix attempts per manual test case
const MAX_TURNS = 30; // cap Claude Code's agentic turns per call
const MANUAL_DIR = "manual-test-cases";
const TESTS_DIR = "tests";
const REVIEW_DIR = "review-needed";
const REPORT_FILE = "flow-check-report.md";
const RESULTS_FILE = "test-results/results.json";
// ----------------------------------------------------------------

const isWin = process.platform === "win32";
const args = process.argv.slice(2);
const OPTS = {
  noAi: args.includes("--no-ai"),
  noFix: args.includes("--no-fix"),
  runtime: args.includes("--runtime"),
};
const FILTERS = args.filter((a) => !a.startsWith("--"));

// ------------------------------ step ids ------------------------------
// Step ids are "N" or "N.M" (sub-steps such as 9.1). A whole number also covers its sub-steps.

function parseId(text) {
  const [major, minor] = String(text).trim().split(".").map(Number);
  return { major, minor: Number.isFinite(minor) ? minor : 0, whole: minor === undefined || !Number.isFinite(minor) };
}

const cmp = (a, b) => a.major - b.major || a.minor - b.minor;

/** A range "a-b" (or a single "a"): does it cover manual step `id`? A whole-number end covers its sub-steps. */
function rangeCovers(range, id) {
  const step = parseId(id);
  if (cmp(step, range.from) < 0) return false;
  if (range.to.whole) return step.major <= range.to.major;
  return cmp(step, range.to) <= 0;
}

const rangeText = (r) => (cmp(r.from, r.to) === 0 ? fmt(r.from) : `${fmt(r.from)}-${fmt(r.to)}`);
const fmt = (id) => (id.whole && id.minor === 0 ? `${id.major}` : `${id.major}.${id.minor}`);

// ------------------------------ manual test case ------------------------------

/** Reads the step table (first column "#", a column "Action") and the title of a manual test case. */
function parseManual(file) {
  const text = readFileSync(file, "utf8");
  const title = (text.match(/^#\s+(.+)$/m) || [, path.basename(file, ".md")])[1].trim();
  const lines = text.split(/\r?\n/);
  const cells = (line) => line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^\s*\|/.test(lines[i])) continue;
    const header = cells(lines[i]).map((h) => h.toLowerCase());
    if (header[0] !== "#" || !header.some((h) => h.startsWith("action"))) continue;
    const col = (name) => header.findIndex((h) => h.startsWith(name));
    const [action, data, expected] = [col("action"), col("test data"), col("expected")];
    const steps = [];
    for (let j = i + 2; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
      const row = cells(lines[j]);
      if (!/^\d+(\.\d+)?$/.test(row[0])) continue;
      steps.push({ id: row[0], action: row[action] ?? "", data: data >= 0 ? row[data] : "", expected: expected >= 0 ? row[expected] : "" });
    }
    if (steps.length) return { file, title, text, steps };
  }
  return { file, title, text, steps: [] };
}

// ------------------------------ spec ------------------------------

const STEP_RE = /test\.step\(\s*[`'"]\s*Steps?\s+(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?\s*:/;
const DEVIATION_RE = /\/\/\s*@flow-deviation\s+(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?\s*:\s*(.+)$/;
const MANUAL_RE = /@manual\s+(\S+\.md)/;

function listSpecs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return listSpecs(full);
    return e.name.endsWith(".spec.ts") ? [full] : [];
  });
}

const norm = (p) => p.replace(/\\/g, "/").replace(/^\.\//, "");

/** Finds the spec section(s) linked to a manual test case with `@manual <path>`; returns its step entries. */
function findSpecEntries(manualFile) {
  const target = norm(manualFile);
  for (const spec of listSpecs(TESTS_DIR)) {
    const lines = readFileSync(spec, "utf8").split(/\r?\n/);
    let current = null;
    let linked = false;
    const entries = [];
    lines.forEach((line, index) => {
      const manual = line.match(MANUAL_RE);
      if (manual) current = norm(manual[1]);
      if (current !== target) return;
      linked = true;
      const step = line.match(STEP_RE);
      const deviation = line.match(DEVIATION_RE);
      if (step) entries.push({ kind: "step", line: index + 1, range: toRange(step[1], step[2]), text: line.trim() });
      if (deviation) entries.push({ kind: "deviation", line: index + 1, range: toRange(deviation[1], deviation[2]), reason: deviation[3].trim() });
    });
    if (linked) return { spec: norm(spec), entries };
  }
  return null;
}

const toRange = (from, to) => ({ from: parseId(from), to: parseId(to ?? from) });

// ------------------------------ check A ------------------------------

/** Structure check: coverage, order, extra steps, merged steps without a reason. */
function checkStructure(manual, specInfo) {
  const issues = [];
  if (!manual.steps.length) return [{ step: "-", line: null, type: "manual_unreadable", reason: `No step table ("#" / "Action") found in ${manual.file}` }];
  if (!specInfo) return [{ step: "-", line: null, type: "spec_missing", reason: `No spec has "@manual ${norm(manual.file)}"` }];

  const steps = specInfo.entries.filter((e) => e.kind === "step");
  const deviations = specInfo.entries.filter((e) => e.kind === "deviation");
  const deviationFor = (range) => deviations.find((d) => rangeCovers(d.range, fmt(range.from)) && (range.to.whole ? rangeCovers(d.range, `${range.to.major}`) : rangeCovers(d.range, fmt(range.to))));

  for (const m of manual.steps) {
    const coveringSteps = steps.filter((s) => rangeCovers(s.range, m.id));
    const coveringDeviation = deviations.find((d) => rangeCovers(d.range, m.id));
    // A sub-step is covered by its parent step; only top-level steps can be "duplicated".
    const topLevel = parseId(m.id).whole;
    if (!coveringSteps.length && !coveringDeviation) {
      issues.push({ step: m.id, line: null, type: "missing", reason: `Manual step ${m.id} ("${m.action}") has no test.step and no @flow-deviation` });
    } else if (topLevel && coveringSteps.length > 1) {
      issues.push({ step: m.id, line: coveringSteps[1].line, type: "duplicate", reason: `Manual step ${m.id} is covered by ${coveringSteps.length} test.step blocks (lines ${coveringSteps.map((s) => s.line).join(", ")})` });
    }
  }

  const manualIds = new Set(manual.steps.map((s) => s.id));
  for (const s of steps) {
    for (const end of [s.range.from, s.range.to]) {
      if (!manualIds.has(fmt(end))) {
        issues.push({ step: fmt(end), line: s.line, type: "extra", reason: `"${s.text}" refers to step ${fmt(end)}, which is not in the manual test case` });
      }
    }
    if (cmp(s.range.from, s.range.to) !== 0 && !deviationFor(s.range)) {
      issues.push({ step: rangeText(s.range), line: s.line, type: "merged_without_reason", reason: `Steps ${rangeText(s.range)} are merged into one test.step without a "// @flow-deviation ${rangeText(s.range)}: <reason>"` });
    }
  }

  // Order: each step / uncoded-step marker must start after the previous one ended.
  const ordered = specInfo.entries.filter((e) => e.kind === "step" || !steps.some((s) => rangeCovers(s.range, fmt(e.range.from))));
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1].range;
    const prevEnd = prev.to.whole ? { major: prev.to.major, minor: Infinity } : prev.to;
    if (cmp(ordered[i].range.from, prevEnd) <= 0 && cmp(ordered[i].range.from, prev.from) !== 0) {
      issues.push({ step: rangeText(ordered[i].range), line: ordered[i].line, type: "out_of_order", reason: `Step ${rangeText(ordered[i].range)} (line ${ordered[i].line}) comes after step ${rangeText(prev)} (line ${ordered[i - 1].line})` });
    }
  }
  return issues;
}

// ------------------------------ Claude calls ------------------------------

function runClaude(prompt, tools) {
  const r = spawnSync(
    "claude",
    ["-p", "--allowedTools", tools, "--permission-mode", "acceptEdits", "--max-turns", String(MAX_TURNS)],
    { input: prompt, encoding: "utf8", shell: isWin, maxBuffer: 64 * 1024 * 1024 }
  );
  if (r.error) throw new Error(`Could not start "claude": ${r.error.message}`);
  return { ok: r.status === 0, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function deviationList(specInfo) {
  const devs = specInfo.entries.filter((e) => e.kind === "deviation");
  return devs.length ? devs.map((d) => `- steps ${rangeText(d.range)} (line ${d.line}): ${d.reason}`).join("\n") : "- none";
}

/** Check B: an independent, read-only reviewer compares each manual step with the code. */
function reviewSemantics(manual, specInfo) {
  const prompt = [
    "You are started by verify_flow.mjs (Loop 2, flow check) as a READ-ONLY REVIEWER. Do not edit any file.",
    `Compare the manual test case ${norm(manual.file)} (the source of truth) with the Playwright code for it in ${specInfo.spec}`,
    `(only the test(s) below its "@manual ${norm(manual.file)}" comment), including the page objects, flows, fixtures and data it calls under src/, fixtures/ and data/.`,
    "For EVERY manual step, check that the code (1) performs the Action, (2) uses the same Test data (credentials may come from .env;",
    "values may come from the data files), and (3) asserts the Expected result with a real expect() or a page-object expect…/wait method",
    "(an action-only step still needs a check that it landed). The step numbers in test.step titles must refer to the right manual steps.",
    "These differences are ACCEPTED (marked // @flow-deviation in the spec) — do not report them unless the code contradicts the reason:",
    deviationList(specInfo),
    "Do not report: locator choices, code style, steps a Playwright test cannot express that are covered by an accepted deviation,",
    "or the manual test case's derived / open-question sections. Report only real mismatches.",
    'Answer with ONLY one JSON object in a ```json block: {"verdict":"pass"|"fail","issues":[{"step":"<manual step id>",',
    '"line":<spec line or null>,"type":"missing_action|wrong_data|missing_assertion|weaker_assertion|wrong_step_number|other","reason":"<one sentence>"}]}',
  ].join("\n");
  const r = runClaude(prompt, "Read,Grep,Glob");
  const json = [...r.out.matchAll(/```json\s*([\s\S]*?)```/g)].pop()?.[1] ?? r.out.slice(r.out.indexOf("{"), r.out.lastIndexOf("}") + 1);
  try {
    const verdict = JSON.parse(json);
    return (verdict.issues ?? []).map((i) => ({ step: String(i.step), line: i.line ?? null, type: i.type ?? "other", reason: i.reason ?? "" }));
  } catch {
    return [{ step: "-", line: null, type: "review_unreadable", reason: `The AI reviewer did not return readable JSON${r.ok ? "" : ` (exit error: ${r.err.slice(0, 200)})`}` }];
  }
}

/** The fixer: changes the code (never the manual test case) so the flow matches. */
function fixFlow(manual, specInfo, issues) {
  const prompt = [
    "You are started by verify_flow.mjs (Loop 2, flow fix). Follow the Loop 2 rules in CLAUDE.md.",
    `The Playwright code in ${specInfo.spec} (the test(s) below "@manual ${norm(manual.file)}") does not follow the manual test case`,
    `${norm(manual.file)}, which is the source of truth and must NOT be edited. Fix the code so every manual step is implemented in order,`,
    "with its Test data and an assertion for its Expected result. Keep the framework conventions: numbered test.step titles",
    "('Step N: …' / 'Steps a-b: …'), locators only as private getters in page objects with the Tosca comment, actions through BasePage,",
    "data in data/, credentials from .env. A merged range or an uncoded step is only allowed with '// @flow-deviation <steps>: <reason>'",
    "when the manual test case's notes justify it or Playwright cannot do it; otherwise implement the step.",
    "If a step needs a locator you cannot see, use this.todo(...) in the page object rather than guessing. Do not run any tests.",
    "Problems found:",
    ...issues.map((i) => `- step ${i.step}${i.line ? ` (spec line ${i.line})` : ""} [${i.type}]: ${i.reason}`),
  ].join("\n");
  return runClaude(prompt, "Read,Grep,Glob,Edit");
}

function typecheck() {
  const r = spawnSync("npm", ["run", "typecheck"], { encoding: "utf8", shell: isWin });
  return r.status === 0 ? null : (r.stdout + r.stderr).split(/\r?\n/).filter((l) => /error TS/.test(l)).slice(0, 10).join("\n") || "typecheck failed";
}

// ------------------------------ runtime check ------------------------------

/** Which manual steps did NOT run in the last recorded run (test-results/results.json)? */
function checkRuntime(manual, specInfo) {
  if (!existsSync(RESULTS_FILE)) return { note: `No ${RESULTS_FILE}; run the tests first.`, rows: [] };
  // Test case ID from the manual title, e.g. "TC01_Demowebshop…" → TC01, "GEP2-36899 | …" → GEP2-36899.
  const tcId = (manual.title.match(/(TC\d+|GEP2-\d+)(?!\d)/) || [])[1];
  const report = JSON.parse(readFileSync(RESULTS_FILE, "utf8"));
  const rows = [];
  (function walk(suite) {
    for (const spec of suite.specs ?? []) {
      if (!tcId || !spec.title.includes(`@${tcId}`)) continue;
      for (const t of spec.tests ?? []) {
        const result = (t.results ?? []).at(-1);
        if (!result) continue;
        const ran = (result.steps ?? []).map((s) => s.title.match(/^Steps?\s+(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?\s*:/)).filter(Boolean).map((m) => toRange(m[1], m[2]));
        const uncoded = specInfo.entries.filter((e) => e.kind === "deviation" && !specInfo.entries.some((s) => s.kind === "step" && rangeCovers(s.range, fmt(e.range.from))));
        const notRun = manual.steps.filter((m) => !ran.some((r) => rangeCovers(r, m.id)) && !uncoded.some((d) => rangeCovers(d.range, m.id))).map((m) => m.id);
        const why = [...(t.annotations ?? []), ...(result.annotations ?? [])].find((a) => a.type === "skip")?.description;
        rows.push({ test: spec.title, status: result.status, notRun, why });
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  })({ suites: report.suites });
  return { note: rows.length ? "" : `No run of a test tagged @${tcId} in ${RESULTS_FILE}.`, rows };
}

// ------------------------------ reports ------------------------------

const escapeCell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

function writeReviewFile(manual, specInfo, issues, attempts, stopReason) {
  mkdirSync(REVIEW_DIR, { recursive: true });
  const file = path.join(REVIEW_DIR, path.basename(manual.file));
  const out = [
    `# Needs human review: ${manual.title}`,
    "",
    `- Manual test case: \`${norm(manual.file)}\``,
    `- Spec: ${specInfo ? `\`${specInfo.spec}\`` : "not found"}`,
    `- Fix attempts: ${attempts.length} of ${MAX_ATTEMPTS}`,
    `- Stopped because: ${stopReason}`,
    "",
    "## Remaining differences",
    "",
    "| Manual step | Spec line | Type | Reason |",
    "| --- | --- | --- | --- |",
    ...issues.map((i) => `| ${escapeCell(i.step)} | ${i.line ? `${specInfo?.spec}:${i.line}` : "—"} | ${escapeCell(i.type)} | ${escapeCell(i.reason)} |`),
    "",
    "## Attempts",
    "",
    ...(attempts.length ? attempts.map((a, n) => `${n + 1}. ${a.count} problem(s) sent to the fixer; ${a.note}`) : ["None (fixing was off or not possible)."]),
    "",
    "## Accepted deviations in the spec",
    "",
    specInfo ? deviationList(specInfo) : "- none",
    "",
  ].join("\n");
  writeFileSync(file, out);
  return file;
}

function writeSummary(results) {
  const out = [
    "# Flow check report (Loop 2)",
    "",
    `Run: ${new Date().toISOString()} · checks: structure${OPTS.noAi ? "" : " + AI review"}${OPTS.runtime ? " + executed steps" : ""}`,
    "",
    "| Manual test case | Spec | Result | Steps | Accepted deviations | Fix attempts |",
    "| --- | --- | --- | --- | --- | --- |",
    ...results.map((r) => `| ${escapeCell(r.title)} | ${r.spec ? `\`${r.spec}\`` : "—"} | ${r.passed ? "✅ flow matches" : `❌ needs review → \`${norm(r.reviewFile)}\``} | ${r.steps} | ${r.deviations} | ${r.attempts} |`),
    "",
  ];
  if (OPTS.runtime) {
    out.push("## Executed steps (last run)", "");
    for (const r of results) {
      if (!r.runtime) continue;
      if (r.runtime.note) out.push(`- **${escapeCell(r.title)}**: ${r.runtime.note}`);
      for (const row of r.runtime.rows) {
        const notRun = row.notRun.length ? `steps not executed: ${row.notRun.join(", ")}` : "all manual steps executed";
        out.push(`- **${escapeCell(row.test)}**: ${row.status}; ${notRun}${row.why ? ` (skip reason: ${row.why})` : ""}`);
      }
    }
    out.push("");
  }
  writeFileSync(REPORT_FILE, out.join("\n"));
}

// ------------------------------ per-test-case loop ------------------------------

const signature = (issues) => issues.map((i) => `${i.step}|${i.type}`).sort().join(";");

const manualFiles = existsSync(MANUAL_DIR)
  ? readdirSync(MANUAL_DIR).filter((f) => f.endsWith(".md") && (!FILTERS.length || FILTERS.some((x) => f.includes(x)))).map((f) => path.join(MANUAL_DIR, f))
  : [];
if (!manualFiles.length) {
  console.error(`🛑 No manual test cases found in ${MANUAL_DIR}/${FILTERS.length ? ` matching ${FILTERS.join(", ")}` : ""}.`);
  process.exit(1);
}

const results = [];
for (const file of manualFiles) {
  const manual = parseManual(file);
  console.log(`\n=== ${manual.title} (${manual.steps.length} manual steps) ===`);
  const manualBefore = manual.text;
  const attempts = [];
  const seen = new Map();
  let specInfo = findSpecEntries(file);
  let issues = [];
  let stopReason = "";

  for (;;) {
    specInfo = findSpecEntries(file);
    issues = checkStructure(manual, specInfo);
    if (issues.length) console.log(`  Check A: ${issues.length} problem(s)`);
    else if (!OPTS.noAi) {
      console.log("  Check A: structure matches. Check B: AI review…");
      issues = reviewSemantics(manual, specInfo);
      console.log(issues.length ? `  Check B: ${issues.length} problem(s)` : "  Check B: every step matches");
    } else console.log("  Check A: structure matches (AI review skipped: --no-ai)");
    for (const i of issues) console.log(`    - step ${i.step}${i.line ? ` (line ${i.line})` : ""} [${i.type}] ${i.reason}`);

    if (!issues.length) break;
    if (!specInfo) { stopReason = "no spec is linked to this manual test case"; break; }
    if (OPTS.noFix || OPTS.noAi) { stopReason = OPTS.noFix ? "fixing is off (--no-fix)" : "fixing needs the AI (--no-ai)"; break; }
    if (attempts.length >= MAX_ATTEMPTS) { stopReason = `still different after ${MAX_ATTEMPTS} fix attempts`; break; }
    const sig = signature(issues);
    if ((seen.get(sig) ?? 0) >= 1) { stopReason = "the same differences came back after a fix (no progress)"; break; }
    seen.set(sig, (seen.get(sig) ?? 0) + 1);

    console.log(`  🩹 Fix attempt ${attempts.length + 1}/${MAX_ATTEMPTS}…`);
    const fix = fixFlow(manual, specInfo, issues);
    let note = fix.ok ? "fixer finished" : "fixer reported an error";
    // The manual test case is the source of truth: undo any edit to it.
    if (readFileSync(file, "utf8") !== manualBefore) {
      writeFileSync(file, manualBefore);
      note += "; it changed the manual test case, which was restored";
    }
    const tsErrors = typecheck();
    if (tsErrors) note += `; typecheck failed: ${tsErrors.split("\n")[0]}`;
    attempts.push({ count: issues.length, note });
    console.log(`  ${note}`);
  }

  const passed = !issues.length;
  const reviewFile = passed ? null : writeReviewFile(manual, specInfo, issues, attempts, stopReason);
  if (!passed) console.log(`  🛑 Needs human review → ${norm(reviewFile)} (${stopReason})`);
  else console.log(`  ✅ Flow matches the manual test case${attempts.length ? ` after ${attempts.length} fix(es)` : ""}`);

  results.push({
    title: manual.title,
    spec: specInfo?.spec,
    passed,
    reviewFile,
    steps: manual.steps.length,
    deviations: specInfo ? specInfo.entries.filter((e) => e.kind === "deviation").length : 0,
    attempts: attempts.length,
    runtime: OPTS.runtime && specInfo ? checkRuntime(manual, specInfo) : null,
  });
}

writeSummary(results);
console.log(`\n📄 ${REPORT_FILE} written.`);
process.exit(results.every((r) => r.passed) ? 0 : 1);
