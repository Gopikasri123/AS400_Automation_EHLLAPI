---
name: tosca-report-to-playwright
description: Use whenever the user uploads, attaches, pastes or points to a Tosca execution report (Tricentis "Execution Test Report" PDF or text, or a manual test case extracted from one), even with no instruction. Converts it end to end, without stopping for review - first into a manual test case, then straight into a Playwright test in this framework - and then reports what was created.
---

# Tosca execution report → manual test case → Playwright test (no review stop)

The user wants the whole conversion done in one go. Do **not** stop between the stages to ask for approval.
Do the stages below in order, then report.

## Stage 0 — Duplicate check (for every test case in the upload)

A report can hold several test cases (e.g. TC01 Size 4 / 8 / 12, TC02, TC03 × 4, TC04). For each one, first find out
whether it is **already converted**: a spec under `tests/` whose test title carries its tag (`@TC01`, `@GEP2-36899`)
or whose `// @manual` file has the same Test Case ID, and/or a file in `manual-test-cases/` for that ID.
Variants of one test case (sizes, payment methods) count as the same test case: check whether the variant is already
covered by the spec's data (e.g. `displaySizes` in `data/demo/tc01.json`).

- **Not converted** → Stages 1-3 as below.
- **Already converted** → do **not** generate a manual case or code again, and do not overwrite anything. Instead:
  1. Extract its manual steps from the upload (Stage 1 rules) into `manual-test-cases/_incoming/<same file name>.md`.
  2. Compare them with the existing `manual-test-cases/<file>.md`: the step table (step numbers, Action, Test data,
     Expected result) and the Test data section. Ignore dates, the byline and wording-only differences.
  3. **Same** → delete the incoming file; report "already converted, no change". Run
     `node verify_flow.mjs <file> --no-fix` to confirm the existing spec still matches, and report its result.
  4. **Different** → keep the incoming file and write `review-needed/<file>.changes.md`: each changed step (old → new),
     added or removed steps, changed test data, and whether the new run PASSED or FAILED. Do not change the spec,
     data or the existing manual case; the user decides.
     A FAILED or partial run (e.g. it stopped at a [BLOCKER]) never replaces a complete manual case: report it as
     "new run failed at step N: <error>" and keep the existing one.
  5. **A new variant** of a converted test case (e.g. a Size 16 that `tc01.json` does not have) → report it as a
     difference to decide (adding it is a data change), not as a new spec.

## Stage 1 — Manual test case

Follow `.claude/commands/tosca-report-to-manual.md` exactly (read it first), with the uploaded / attached report as
INPUT. Save the result to `manual-test-cases/<Test Case ID>.md`.

If the upload already **is** a manual test case (a step table converted from a Tosca report), skip Stage 1, save it
under `manual-test-cases/` and use it as the Stage 2 input. (If that test case is already converted, Stage 0 handles it.)

## Stage 2 — Playwright test

Follow `.claude/commands/manual-to-playwright.md` exactly (read it first), with the Stage 1 file as INPUT.
Treat that manual test case as approved: the user has chosen not to review it.

Framework facts to respect (read the code to confirm, do not assume):
- Demo Web Shop test cases go in `tests/demo/`, pages in `src/demo/`, data as one JSON per test case in `data/demo/`
  (loaded by `data/demo/demoTestCases.ts`), fixtures in `fixtures/demoFixtures.ts`, project `demo-webshop`.
- GEP test cases go in `tests/orders/`, pages in `src/pages` / `src/components`, data in `data/`.
- Page objects extend `src/core/BasePage.ts`, keep locators `private` with a comment naming the Tosca step above each
  getter, and act only through BasePage methods. Credentials only from `.env` via `src/config/env.ts`.
- Capture real locators from the live site where it is reachable; otherwise leave a marked TODO (see the command).
- After adding locators, run `npm run locators` and `npm run typecheck`.

## Stage 3 — Flow check (Loop 2)

Run `node verify_flow.mjs <manual file name, e.g. TC05>`. It compares the new spec with the manual test case
step by step (structure, then an AI review), fixes differences itself up to 3 times, and writes
`flow-check-report.md`, or `review-needed/<manual test case>.md` when it cannot resolve them.
Do not edit the manual test case to make it pass. Include the result in the final message.
(`verify_flow.mjs` only reads `manual-test-cases/*.md`, so files in `manual-test-cases/_incoming/` are never checked as test cases.)

## Where the commands say "ask"

Both commands tell you to ask when something is ambiguous. In this skill, do **not** pause: record the question under
Open Questions (Stage 1) or Deviations / TODOs (Stage 2), make the smallest safe choice or leave a TODO, continue, and
list every such point in the final message.

## Run it once

- **Demo Web Shop:** run the new test once (`npx playwright test --project=demo-webshop --grep @<TC-ID>`) and fix only
  code you wrote if it fails on your own mistake (a wrong locator or a typo). A site outage or a data problem is
  reported, not "fixed".
- **GEP:** do **not** run it. Every GEP test places a real order on the QA site; tell the user it is ready to run.

## Final message to the user

Keep it short. Start with one table, one row per test case in the upload:
`| Test case | Result |` with "New → converted", "Already converted, no change", or
"Already converted, report differs → review-needed/<file>.changes.md". Then, for the converted ones:
1. Files created or changed (manual test case, spec, pages, data, fixtures).
2. The run result (passed / failed and why / not run and why).
3. Flow check result (Loop 2): matches, or the review-needed file and why.
4. Traceability: manual step count → steps covered in code.
5. Deviations and TODOs, including every point where the commands would have asked.
Nothing is committed.
