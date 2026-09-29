from framework.config import load_config
from framework.terminal import Terminal

def dump(t, label):
    s = t.session
    print(f"\n===== {label} | {s.rows}x{s.cols} | cursor {s.cursor_rc()} =====")
    for i, row in enumerate(s.screen_rows(), 1):
        print(f"{i:2}|{row.rstrip()}")

cfg = load_config()
t = Terminal(cfg)
t.open()
try:
    t.sign_on()
    t.run_command("STRSQL")
    t.session.wait()
    dump(t, "A. clean STRSQL entry (nothing typed)")

    t.session.send("DELETE FROM QTEMP.NOSUCHTABLE@E")   # harmless: errors, no data screen
    t.session.wait()
    dump(t, "B. after 1st statement")

    t.session.send("DELETE FROM QTEMP.NOSUCHTABLE@E")   # repeat to reveal retention
    t.session.wait()
    dump(t, "C. after 2nd statement")
finally:
    t.close()
