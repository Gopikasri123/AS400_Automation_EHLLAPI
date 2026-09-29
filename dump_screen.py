from framework.config import load_config
from framework.terminal import Terminal

cfg = load_config()
t = Terminal(cfg)
t.open()
try:
    s = t.session
    print(f"session {cfg.session} | size {s.rows}x{s.cols} | cursor {s.cursor_rc()}")
    print("-" * s.cols)
    for i, row in enumerate(s.screen_rows(), 1):
        print(f"{i:2}|{row}")
    print("-" * s.cols)
finally:
    t.close()
