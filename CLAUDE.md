# CLAUDE.md — GEP Automation: project notes and self-healing locator playbook

You are working in a Playwright + TypeScript test framework converted from Tosca.
When you are started by `heal_single_TS.mjs`, your only job is to fix **broken locators** (see the playbook
below). Read this file fully before editing anything. These rules override convenience.

## Tosca execution reports (interactive sessions, not heal runs)
When the user uploads, attaches or pastes a **Tosca execution report** (or a manual test case extracted from one),
use the `tosca-report-to-playwright` skill: convert it to a manual test case and straight on to a Playwright test,
**without stopping for review**, then report what was created. The user does not need to ask.

## Loop 2: flow check (started by `verify_flow.mjs`)
`verify_flow.mjs` checks that each Playwright test follows its manual test case (`manual-test-cases/*.md`) step by step.
The heal-only rules further down apply to `heal_single_TS.mjs` runs; when started by `verify_flow.mjs`, these apply instead:
- **Reviewer** (read-only): compare and report; never edit a file.
- **Fixer**: change the spec, page objects (`src/`), fixtures or data (`data/`) so every manual step is implemented in
  order, with its test data and an assertion for its expected result. **Never edit `manual-test-cases/`**: it is the
  source of truth (the script restores it if it changes). Never run tests (GEP tests place real orders).
- Linking: each spec carries `// @manual manual-test-cases/<file>.md` above the test(s) it implements.
- Step titles are numbered like the manual case: `test.step('Step N: …')`, or `test.step('Steps a-b: …')` for a range
  (a whole number also covers its sub-steps, e.g. `Steps 8-9` covers 9.1-9.5).
- A merged range, or a step with no code of its own (e.g. "close the browser"), needs
  `// @flow-deviation <step or a-b>: <reason>` directly above it (or where the step would be). Only use it when the manual
  case's own notes justify it or Playwright cannot do the step; otherwise implement the step.
- Keep the framework conventions below (private locators with the Tosca comment, BasePage methods, data in `data/`,
  credentials from `.env`). If a locator cannot be seen, use `this.todo(...)` rather than guessing.

## Repo layout
- **Two applications**, both tested against **remote sites**. The application source code is **not** in this repo.
  - **GEP** (Henry Schein web shops): US QA `https://www.us.qa.eschein.com/en-us`, UK QA `https://www.uk.qa.eschein.com/`
    (profiles in `src/config/markets.ts`). Tests: `tests/orders/GEP_Orders.spec.ts`.
  - **Demo Web Shop**: `https://demowebshop.tricentis.com` (project `demo-webshop`). Tests: `tests/demo/`.
- Locators live **only** in page objects and components, as `private` getters (or private methods taking a value):
  - GEP: `src/pages/`, `src/components/` (incl. `popups/`, `orders/`), `src/utils/GepDatePicker.ts`
  - Demo Web Shop: `src/demo/components/`, `src/demo/pages/`
- Shared base class: `src/core/BasePage.ts` (all clicks, fills and checks go through its methods).
- Flows `src/flows/`, `src/demo/flows/`; regions (Gen X / Y / Z) `src/regions/`; test data `data/`; fixtures `fixtures/`.
- Machine-readable last run: `test-results/results.json` (Playwright JSON reporter).
- Locator checklist: `LOCATORS_TODO.md`, generated from the code by `npm run locators`.

## Framework conventions a heal must keep
- Every locator getter has a comment directly above it: `// Tosca: <module> > <control>   | <hint>`
  (demo pages use `// Demo site: ...` or `// Tosca TC04 step N: ...`). **Keep the comment**; you may update the hint
  after `|` to say what changed. The locator report depends on this comment.
- Keep the getter's **name and visibility** (`private`) unchanged; change only the locator expression it returns.
- Never put a locator in a spec, flow or region file.
- Prefer `data-test-id` (GEP uses `data-test-id`, not `data-testid`) or role-based locators.
- Getters that return `this.todo(...)` are **not captured yet**. They are not heal cases: leave them alone.

## What you are allowed to change
- ONLY the locator expression inside an existing locator getter in the files listed above.
- `heal-report.md` (append your report).
- Nothing else.

## What you must NEVER change
- Assertions, `expect(...)` values, test titles, test steps, test logic, waits/timeouts, test data (`data/`),
  `.env`, config, fixtures, flows, regions, or `BasePage`.
- Never read or print `.env`: it holds passwords.
- Never run the tests yourself: every GEP test **places a real order** on the QA site. The heal script runs them.
- If a test fails on an assertion or an app behaviour, that is a **candidate real bug** — do not touch it.
  Report it and stop for that test.

## Only heal selector-resolution failures
Heal a test ONLY when its error is one of:
- "waiting for locator ..." / "waiting for getBy...(" / a locator action Timeout
- locator "resolved to 0 elements"
- "strict mode violation" (locator now matches multiple elements)
- element not found / not attached because the selector no longer matches

If the failure is an assertion mismatch, wrong text/price/status, navigation error, network/500, or a real
behavioural change — DO NOT heal. Flag it.

## Missing data is not a broken locator
The same "waiting for locator" error appears when the element is **legitimately absent** because of test data or
account setup, not because the selector changed. Do NOT heal these; flag them as data/environment problems:
- A dropdown or list opens, but the expected **option or value** is not among its entries
  (e.g. payment option "Bill On Account" missing for the account, a product ID not found, an order status differs).
- The locator is built from test data (a product ID, order number, frequency, status or option name passed in).
- The element depends on account state (an empty cart, no unplaced orders, no Pending orders).
Look at the saved page snapshot for the failure (`test-results/**/error-context.md`): if the surrounding container is
present and its other entries are there, the locator is fine and the data changed.

## How to find the correct new locator
There is no application source in this repo, so the element can only be found on the **rendered page**.
1. **Failure evidence (primary, always available)** — read the failing test's error in `test-results/results.json`
   and its page snapshot in `test-results/**/error-context.md` (an accessibility tree of the page at the moment of
   failure). Find the *same element* the old locator meant by its purpose and context (nearby label, heading,
   section, role, text), and read its current role, name, text or attributes.
2. **Live page (when available)** — if browser tools (Playwright MCP) are available in this session, open the site
   and confirm the element and its attributes on the rendered page. GEP pages sit behind a login; do not type or
   read credentials yourself. If you cannot reach the page, rely on step 1 only.
3. **grep the repo** — check how the same element or its neighbours are located elsewhere in `src/` (other page
   objects often use the same `data-test-id` family) and keep the new locator consistent with them.

Never invent a selector that you have not seen in the failure evidence or on the live page.
If several elements look similar and you can't tell which one the old locator meant, treat it as low confidence and
flag it (see the confidence gate).

## Heal toward resilient locators (do not just swap one brittle class for another)
Preference order when writing the replacement:
1. `data-test-id` attribute (`this.page.locator('[data-test-id="..."]')`) — the GEP site's own test hooks
2. `getByRole(...)` (with name)
3. `getByLabel(...)` / `getByPlaceholder(...)` / `getByText(...)`
4. CSS/class selector or XPath — last resort only
If a test id would clearly prevent future breakage, note it in the report as a suggestion.

## Confidence gate
If you are not confident the new locator maps to the *same element the test intended*, STOP and flag it.
A wrong "fix" that makes a test pass is worse than a red test. Never guess.

## Output
After editing, append a heal report to `heal-report.md` with, per test:
- test file + title
- page object file + getter name
- old locator → new locator
- why (which snapshot line / which page evidence)
- confidence (high / medium)
- reminder: a human must run `npm run locators` so `LOCATORS_TODO.md` matches the code (CI checks it)
Leave all edits **uncommitted**. A human reviews before merge. Do not commit or push.
