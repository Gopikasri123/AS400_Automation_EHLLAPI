# PUB400 USERS CRUD Automation Framework

A data-driven automation framework that runs a full **Create / Read / Update /
Delete** lifecycle against the `USERS` table on PUB400 (IBM i / AS400), driving
the live, visible ACS 5250 emulator through the **ACS EHLLAPI** bridge. The
input comes from a test data management file (CSV), every step is verified on
the screen, and each run emits console, CSV and HTML reports.

## The flow

| # | Step | What is verified |
|---|------|------------------|
| 1 | Open the saved session (`A.hod`), sign on | IBM i Main Menu is displayed |
| 2 | From the Main Menu run `STRSQL` | "Enter SQL Statements" prompt is available |
| 3 | `SELECT COUNT(*)` and `SELECT ... WHERE USER_ID = <id>` | table is accessible; the test USER_ID does not exist yet |
| 4 | `INSERT` the user | `1 rows inserted` |
| 5 | `SELECT` the user | 1 row displayed; USER_ID, USER_NAME, EMAIL, CITY, PHONE each match |
| 6 | `UPDATE` the `update_*` fields | `1 rows updated` |
| 7 | `SELECT` the user | updated fields changed, all other fields unchanged |
| 8 | `DELETE` the user | `1 rows deleted` |
| 9 | `SELECT` the user | no record found |
| 10 | F3 → Exit Interactive SQL (option 1) | back on the Main Menu |
| 11 | `SIGNOFF`, close the emulator window | sign-on screen shown; session disconnected |

Steps 3–9 run once per test-data row. If the USER_ID in a row already exists,
that case is skipped so existing data is never changed.

## Layout

```
run_crud.py                  orchestrator + CLI: steps 1, 2, 10, 11 and reports
│
├─ operations/
│   └─ user_crud.py          steps 3-9 for one test-data row
│
├─ framework/                reusable engine
│   ├─ ehllapi.py            low-level ctypes wrapper over hllapi()
│   ├─ terminal.py           launch/close emulator, sign-on/off, menus, commands
│   ├─ strsql.py             STRSQL open / execute / close; reads Display Data
│   ├─ csv_loader.py         test data input
│   ├─ results.py            StepResult model + console/CSV/HTML reporting
│   ├─ config.py             typed config
│   ├─ logger.py             console + file logging
│   └─ exceptions.py         one exception type per failure mode
│
├─ config/config.ini         editable settings
├─ data/users_testdata.csv   test data management file
└─ reports/                  generated logs and reports
```

## Prerequisites

* Windows with a **64-bit Python 3.8+**. No `pip install` needed — standard
  library only.
* IBM i Access Client Solutions with the **EHLLAPI Bridge** installed
  (`pcshll32.dll` under `C:\Program Files (x86)\IBM\EHLLAPI\64`).
* The PUB400 5250 session saved as `Desktop\A.hod` (in ACS: *File > Save As...*),
  short name `A`. If the session is not open, the runner launches it from that
  file; if it is already open and signed on, the runner uses it as is.
* The table `GOPIKAS1.USERS`
  (`USER_ID INTEGER, USER_NAME VARCHAR(50), EMAIL VARCHAR(100), CITY VARCHAR(50), PHONE VARCHAR(20)`).

## Setup

Edit `config/config.ini`:

* `[connection]` — `user`, `password` (or set the `PUB400_PASSWORD` environment
  variable, which takes precedence).
* `[database]` — `library`, `table`, `key_column`, `numeric_columns`.
* `[launch]` — `session_file`, `launcher`, `show_window`, `close_emulator`.
* `[runtime]` — `test_data` (file under `data_dir`), `slowmo`, `trace`.

## Run

```
python run_crud.py                      # every test-data row with run=Y
python run_crud.py --case TC_USR_01     # one test case (repeat to combine)
python run_crud.py --data other.csv     # another test data file
python run_crud.py --slowmo 2 --trace   # slow, narrated — good for demos
python run_crud.py --fast               # full speed, minimal logging (CI)
python run_crud.py --keep-open          # leave the emulator open at the end
```

The runner exits non-zero if any step fails, so it drops straight into CI.

## Test data management

`data/users_testdata.csv` — one row per test case. Rows whose first cell starts
with `#` are ignored.

```
test_id,run,description,user_id,user_name,email,city,phone,update_city,update_phone
TC_USR_01,Y,Full CRUD lifecycle for a new user,9001,Test User,test.user@example.com,Chennai,9876500001,Madurai,9876500002
```

* `run` — `Y` to execute, `N` to keep the row but skip it.
* `user_id, user_name, email, city, phone` — the values inserted in step 4 and
  verified in step 5. Each column maps to the table column of the same name; an
  empty value is inserted as NULL.
* `update_<column>` — new values for step 6 (e.g. `update_email`). Leave empty to
  keep that column unchanged. Add or remove `update_*` columns freely.
* Use a USER_ID that does not already exist in the table.

## Reports

Written to `reports/` per run:

* `run_<timestamp>.log` — full trace of every keystroke and screen result.
* `results_<timestamp>.csv` — one row per step.
* `report_<timestamp>.html` — self-contained, colour-coded report.

## Emulator behaviour this framework relies on

Verified on PUB400 with ACS; if something changes, these are the places to look.

* **Entry area clearing** (`strsql.py` `_clear_entry`): STRSQL keeps a failed
  statement in the entry area, Set Cursor is a no-op and each entry line is a
  separate field, so every line is cleared with Tab + Erase EOF before typing.
* **Wide results** (`strsql.py` `_read_display_data`): Display Data shows 79
  positions at a time; wider rows are read via *Shift to column* and stitched.
* **Numbers** are shown with `.` as thousands separator (`9001` → `9.001`);
  columns listed in `numeric_columns` are compared without separators.
* **Exit Interactive SQL**: the script presses Enter to accept the pre-filled
  option 1 (save and exit); typing into that one-character field is unreliable.
* **Closing ACS**: after the window closes, the script waits for the ACS process
  to exit, otherwise a new launch is handed to the exiting process and lost.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `MSGCLS003 ... ('system')` popup | The launcher got `/plugin=5250`; the runner passes only the `.hod` path. |
| `Connect to session 'A' failed` / timeout after launch | Check the saved session's short name is `A`, and no other 5250 session is open. |
| `CPF1120 ... password not correct` | Wrong password — check `PUB400_PASSWORD` is not set to an old value. |
| Case `skipped: USER_ID ... is not free` | That USER_ID already exists; pick another in the test data. |
| `WinError 193` loading the DLL | 32/64-bit mismatch — use the `...\EHLLAPI\64\pcshll32.dll` path with 64-bit Python. |
