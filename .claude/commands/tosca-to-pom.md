---
description: Build a Playwright POM skeleton from a Tosca export (locators as TODO), or fill the locators later from the live site
argument-hint: <path-to-tosca-export.txt>  |  fill <BASE_URL> [page-name]
---

# Tosca export to Playwright POM skeleton

This command has two modes, chosen by `$ARGUMENTS`:

- **Build mode** (default): `/tosca-to-pom tosca-exports/tc1_gep.txt` builds page objects, a test spec and a locator checklist. Every locator is left as a TODO placeholder.
- **Fill mode**: `/tosca-to-pom fill https://<site-url> [PageName]` opens the live site and replaces the TODO locators with real ones. Run it once the web URL is confirmed.

The default stack is **Playwright + TypeScript**. If the repo already has a Playwright (or other) project, follow its existing folder layout, naming and conventions instead of the defaults below.

---

## BUILD MODE

### Step 1 – Read the export

- The export is tab-separated: `Name | Value | ActionMode | DataType | WorkState`. The number of leading tabs is the nesting depth.
- Write a small Python script that prints `depth | name | value | actionmode` for every row, and work from that output.
- Collect every **Tosca module** (the row that groups controls, e.g. `Header |Cart`, `PDP|QuantityInput`, `Shipping & Billing | PO number`) and the **controls** under it (e.g. `cart-icon`, `quantity-box`, `PO# value`).
- Ignore automation plumbing: TBox Wait, Delete/Set Buffer, TDM lookups (`GetTestDatafromTDM`, `TestData - …`, `Set Extracted Values`), taskkill and JavaScript reloads.
- If `manual-test-cases/<TC-ID>.md` exists, read it too. The spec should follow its step order.

### Step 2 – Group controls into pages

Map each Tosca module to a page object by the page it belongs to. Use the module name prefix as the main clue:

| Tosca module prefix | Page object |
|---|---|
| `Header …`, `HomePage …`, global search | `HeaderPage` |
| Cookie, ad, survey, `Launch popup`, Free Item, License, Controlled Substances | `Popups` (component) |
| `Login …`, `Enter Valid creditionals`, `Sign In`, security question | `LoginPage` |
| `SRP …` | `SearchResultsPage` |
| `PDP …` | `ProductDetailPage` |
| `Shopping Cart …`, `Checkout | Proceed to Shipping…` | `ShoppingCartPage` |
| `Shipping & Billing …`, `GenX|Shipping & Billing …`, `Shipping and billing | Credit Card…` | `ShippingBillingPage` |
| `Review Order …` | `ReviewOrderPage` |
| `Checkout | Order Confirmation`, `Order Number` | `OrderConfirmationPage` |
| `Account Dashboard`, `Orders …` | `OrdersPage` |

Merge duplicate controls, i.e. the same control used in several places, into a single locator.

### Step 3 – Generate these files

```
automation/
  playwright.config.ts          baseURL = process.env.BASE_URL (no hard-coded URL)
  .env.example                  BASE_URL=, COUNTRY=, REGION=, INCOGNITO=, USER_TYPE=, USERNAME=, PASSWORD=, PRODUCT_ID=
  src/pages/BasePage.ts         shared helpers (see below)
  src/pages/<Name>Page.ts       one per page from Step 2
  src/components/Popups.ts      optional popups / overlays
  tests/<TC-ID>.spec.ts         the test flow
  test-data/<TC-ID>.json        placeholders only, never real credentials
  LOCATORS_TODO.md              checklist of every locator to fill
```

### Step 4 – Locator rules (the most important part)

Define every locator as a **getter** that calls `this.todo(...)`. The page classes then compile and can be constructed, and a test fails with a clear message only when it reaches an unfilled locator.

`BasePage.ts` must include:

```ts
import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Placeholder for a locator that hasn't been captured yet. Replace it in fill mode. */
  protected todo(key: string, toscaRef: string): Locator {
    throw new Error(
      `Locator not filled yet: ${key} (Tosca: ${toscaRef}). See LOCATORS_TODO.md`
    );
  }

  /** For optional popups: click only if the element appears within the timeout. */
  protected async clickIfVisible(locator: Locator, timeout = 5000): Promise<boolean> {
    try {
      await locator.waitFor({ state: 'visible', timeout });
      await locator.click();
      return true;
    } catch {
      return false;
    }
  }
}
```

Each locator looks like this:

```ts
// Tosca: Header |Cart > cart-icon   | hint: may be id "cart-icon" (unverified)
get cartIcon(): Locator {
  return this.todo('HeaderPage.cartIcon', 'Header |Cart > cart-icon');
}
```

- Always keep the `// Tosca:` comment. It is the link back to the Tosca control.
- When a Tosca control name looks like an HTML id or class (e.g. `cart-icon`, `quantity-box`, `basic-addon2`), add it as an **unverified hint** in the comment only. Never use it as the real locator in build mode.
- Never invent XPath, CSS, ids or test-ids.
- Use camelCase getter names that describe the element: `submitYourOrderButton`, `poNumberInput`.

### Step 5 – Page methods and the spec

- Page methods are **business actions**, not single clicks: `login(username, password)`, `clearCartIfNotEmpty()`, `searchAndOpenProduct(productId)`, `setQuantity(qty)`, `selectPaymentMethod(region, country)`, `enterPoNumber(region)`, `submitOrder()`, `getOrderNumber()`, `searchSubmittedOrder(orderNumber)`.
- Region and country branches from Tosca (`Run Only for Gen X Countries`, `ValidCountries` = `IT`, …) become `if` / `switch` logic on `REGION` and `COUNTRY`, read from env or test data. Put a comment at each branch naming the Tosca condition it came from.
- Optional popups (cookies, ads, Confirmar, Free Item, License, Controlled Substances, survey, budget overlay) go through `clickIfVisible`.
- Remove fixed waits. Rely on Playwright auto-waiting, and on `expect(...).toBeVisible()` in places where Tosca used WaitOn.
- Assertions come from the Tosca `Verify` rows. For example: `await expect(confirmation.successMessage).toBeVisible()`, and the first row in the orders table has text equal to the captured order number.
- The spec reads all data from `test-data/<TC-ID>.json` and env variables. Keep hard-coded Tosca literals (e.g. PO `3787329720`, answer `Test`, quantity `50`) as named constants with a comment.
- Skip Tosca steps that look like leftovers (e.g. a second login with hard-coded `testproduct1` / `Test@123`). List them in the summary.

### Step 6 – LOCATORS_TODO.md

Create one row per locator:

```markdown
| Page | Getter | Tosca module > control | Hint | Status | Locator | Source |
|---|---|---|---|---|---|---|
| HeaderPage | cartIcon | Header \|Cart > cart-icon | id "cart-icon"? | TODO | – | – |
```

Status is one of `TODO`, `Filled`, or `Needs review`.

### Step 7 – Verify and summarise

- Run `npx tsc --noEmit`, if TypeScript is set up, and fix any compile errors. The skeleton must compile even though the locators are TODO.
- Don't run the tests. They are expected to fail at the first TODO locator.
- Print a short summary covering:
  - the files created
  - the number of pages
  - the number of TODO locators
  - any Tosca steps that were skipped as suspicious

---

## FILL MODE (run once the URL is confirmed)

`/tosca-to-pom fill <BASE_URL> [PageName]`

1. Write the URL into `.env` as `BASE_URL` (not into code), unless it is already set.
2. Open the site with Playwright. Use a browser MCP tool if one is available. Otherwise, write a small script that navigates the flow and saves ARIA snapshots and the relevant DOM.
   - Test credentials come from `.env`. Never write credentials into code or logs.
   - If a `PageName` is given, fill only that page.
3. For each `TODO` row in `LOCATORS_TODO.md`, find the element and pick a locator in this order of preference:
   1. `getByRole(role, { name })`
   2. `getByLabel`, `getByPlaceholder`
   3. `getByTestId` (only if the site has `data-testid` attributes)
   4. A stable `id` or CSS attribute
   5. `getByText` (only for static text)
   6. XPath (last resort; add a comment explaining why)
4. Replace the `this.todo(...)` body with the real locator. Keep the `// Tosca:` comment.
5. Update the checklist row: set Status to `Filled`, record the Locator, and set Source to `live site <date>`.
   - Only mark a row `Filled` when the locator was checked against the page and matched **exactly one** element.
   - If it matched zero or several elements, or the element only appears in some regions or countries, set Status to `Needs review` and add a note.
6. Run `npx tsc --noEmit`, then run the spec for one country. Report which steps pass, and which locators are still `TODO` or `Needs review`.

Alternative: if you have a **Tosca Modules export** that includes the technical properties, you can run `/tosca-to-pom fill modules <path>`. Claude Code then maps each Tosca control to its id, XPath or CSS from that export. Mark these rows `Filled` with Source `Tosca module`. Also flag brittle absolute XPaths as `Needs review`.
