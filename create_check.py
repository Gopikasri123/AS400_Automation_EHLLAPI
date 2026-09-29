from framework.config import load_config
from framework.terminal import Terminal

def dump(t, label):
    s = t.session
    print(f"\n===== after: {label} | cursor {s.cursor_rc()} =====")
    for i, row in enumerate(s.screen_rows(), 1):
        r = row.rstrip()
        if r:
            print(f"{i:2}|{r}")

cfg = load_config()
t = Terminal(cfg)
t.open()
try:
    t.sign_on()
    t.run_command("STRSQL")
    t.session.wait()
    tbl = cfg.qualified_table
    stmts = [
        f"DROP TABLE {tbl}",
        f"CREATE TABLE {tbl} (ID INTEGER NOT NULL PRIMARY KEY, NAME VARCHAR(50) NOT NULL, EMAIL VARCHAR(100), CITY VARCHAR(50))",
        f"SELECT * FROM {tbl}",
    ]
    for stmt in stmts:
        t.session.send("@A@F")          # Erase Input - clear retained statement
        t.session.send(stmt + "@E")     # type + run
        t.session.wait()
        if t.contains("Confirm Statement"):
            t.session.send("@E"); t.session.wait()
        dump(t, stmt[:45])
finally:
    t.close()
