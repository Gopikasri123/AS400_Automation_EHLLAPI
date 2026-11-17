---
description: Convert a Tosca test case export (.txt, tab-indented) into a manual QA test case in Markdown
argument-hint: <path-to-tosca-export.txt> [more files...]
---

# Convert Tosca export to a manual QA test case

Convert the Tosca export file(s) at `$ARGUMENTS` into manual test cases that a tester can execute without Tosca.

If no path is given, look for `*.txt` files in `tosca-exports/` and ask which one to convert.

## Step 1 – Read the export correctly

Tosca exports are tab-separated text with these columns:

`Name | Value | ActionMode | DataType | WorkState`

- **Indentation is the hierarchy.** The number of leading tabs before `Name` is the nesting depth. Do not guess the structure by reading the file visually. Instead, write a small Python script that prints each row as `depth | name | value | actionmode`, and work from that output.
- The **first row** is the test case: `"<TC-ID> | <Title>"` plus its WorkState.
- Top-level folders are usually **Preconditions**, **Process**, and **Post condition**. These map directly to the sections of the output.
- Large files (70 KB+) are normal. Read the whole file, because important steps can appear near the end.

## Step 2 – Translate Tosca rows into manual steps

| Tosca pattern | Manual equivalent |
|---|---|
| ActionMode `Input` with value `x`, `X`, `{Click}` or `{CLICK}` | "Click **<control name>**" |
| `Input` with `{SENDKEYS[...]}`, `{TEXTINPUT[...]}` or plain text | "Enter <value> in **<field>**" |
| `Input` with `{BACKSPACE}{SENDKEYS[50]}` | "Clear the field and enter 50" |
| `Input` with `{SCROLL[...]}` | "Scroll to …" (only when it matters to the tester) |
| ActionMode `Select` on a dropdown, with a child row | "Select **<option>** from <dropdown>" |
| ActionMode `Verify` | Expected result: "<control> is displayed", "<control> text equals <value>", etc. |
| ActionMode `WaitOn` | Fold into the expected result ("… page is displayed") |
| ActionMode `Buffer` (e.g. `InnerText -> Ordernumber`) | "Write down the <value>". Later `{B[Ordernumber]}` references become "the order number from step N" |
| `If` / `Condition` / `Then` / `Else` | A single conditional step: "If <condition> appears, <action>" |
| `TBox Start Program` to launch Chrome, or `Launch the URL` | "Open Chrome and go to the site URL" (mention incognito if `--incognito` is used) |
| `TBox Start Program` running `taskkill ... Chrome.exe` | Precondition or post-condition: "All Chrome windows are closed" |
| `CloseBrowser` | Post-condition: "Close the browser" |
| `Execute JavaScript` running `window.location.reload` | "Refresh the page" |

### Test data placeholders

- `{CP[Name]}` is a **test case parameter** (Country, Incognito, UserType, Domain, …). List every one under **Parameters**.
- `{TD[...]}` and the `TestData - Expert module` / `Find & provide item` rows are **test data lookups**. Describe what is fetched (for example "valid username/password for the UserType" or "product ID"). Do not copy the TDM query itself.
- `{B[Name]}` is a **value from an earlier step**. Reference that step by number.
- `{RND[7]}` means "a random 7-digit number".
- Keep hard-coded literals as written, for example `3787329720` or `Test`.

### Leave these out of the manual steps

These are automation plumbing and have no meaning for a manual tester:

- `TBox Wait`, `Wait for Application to Load`, `Apply small wait` and `Apply medium wait`
- `TBox Delete Buffer` and `TBox Set Buffer`, unless the buffer carries a value the tester needs to remember
- `GetTestDatafromTDM`, `Set Extracted Values`, `TestData - Update item` and `GetTestDatafromTDM_Reference`
- Duplicate WaitOn/Click pairs on the same control. These become one step.

### Region and country branches

- Conditions such as `Run Only for Gen X/Y/Z Countries` or `Evaluate GenX Countries` become region notes, for example "*(GenX only)*".
- `Run Only for Valid Countries` together with a `ValidCountries` buffer (such as `NL` or `FR,AT,ES,DE,BE,NL,IT`) becomes a country note, for example "*(NL only)*".
- When several regions do different things at the same point, keep it as **one step** that lists each variant, for example: "GenX/GenY: select **Bill on Account**. GenZ (IT): select … GenZ (others): select the first option."
- Collapse repeated blocks, such as cookie or ad-popup handling that appears once per region, into one conditional step.

## Step 3 – Output format

Write one file per test case at `manual-test-cases/<TC-ID>.md`, using exactly this structure:

```markdown
# <TC-ID> – <Title>

| Field | Details |
|---|---|
| **Test Case ID** | <TC-ID> |
| **Title** | <clear, readable title> |
| **Module** | <inferred from the steps, e.g. Checkout / My Account – Orders> |
| **Type** | Functional / End-to-End |
| **Status (Tosca)** | <WorkState> |
| **Browser** | <from the launch steps> |
| **Parameters** | <all CP[...] names> |

## Preconditions
1. ...

## Test Steps
| # | Action | Test Data | Expected Result |
|---|---|---|---|
| 1 | ... | ... | ... |

## Post-conditions
1. ...

## Expected Final Result
<one or two sentences stating what the test proves>

## Review Notes (issues in the Tosca script)
- ...
```

### Writing rules

- Use plain, concise language, with one user action (or one closely related group of actions) per step.
- Put control names exactly as they appear on screen in **bold**, e.g. **Submit Your Order** or **Accept All**.
- Give every step an Expected Result. Use `–` in Test Data when there is none.
- Keep the steps in the same order as the Tosca Process section.
- Never invent URLs, credentials, product IDs or messages. If a value exists only in TDM, describe it instead.

### Review Notes – always check for these

List anything that looks wrong in the Tosca script, for example:

- A second login, or other hard-coded credentials, next to the test-data-driven ones
- The same field filled twice, where the second entry may overwrite the first
- A condition that uses ActionMode `Input` where `Verify` was intended (e.g. `Exists = True` with `Input`)
- Empty `Else` or "Temp fix" branches
- A lookup that reads an unexpected column (e.g. Domain read from `Password`)
- Typos in buffer names that differ only by case (e.g. `CountryName1` vs `Countryname1`)

If nothing looks wrong, write "None found."

## Step 4 – Finish

After writing the file(s), print a short summary covering:

- The output path
- The number of steps
- The parameters found
- The number of review notes

Do not repeat the whole test case in the terminal.
