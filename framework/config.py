"""Typed configuration.

Values are read from ``config/config.ini``; the password is taken from the
``PUB400_PASSWORD`` environment variable and never stored on disk.
"""
import configparser
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List

from .exceptions import FrameworkError


@dataclass
class Config:
    # connection
    session: str
    host: str
    user: str
    password: str
    # database
    library: str
    table: str
    key_column: str
    numeric_columns: List[str]
    # emulator
    dll_path: str
    dll_dirs: List[str]
    screen_rows: int
    screen_cols: int
    autodetect: bool
    # launch
    auto_launch: bool
    session_file: str
    launcher: str
    launch_timeout: float
    show_window: bool
    maximize_window: bool
    close_emulator: bool
    # runtime
    slowmo: float
    trace: bool
    wait_retries: int
    wait_interval: float
    report_dir: str
    data_dir: str
    test_data: str

    @property
    def qualified_table(self) -> str:
        """LIBRARY.TABLE, the form SQL statements use."""
        return f"{self.library}.{self.table}"


def load_config(path: str = "config/config.ini") -> Config:
    ini_path = Path(path)
    if not ini_path.exists():
        raise FrameworkError(f"Config file not found: {ini_path.resolve()}")

    parser = configparser.ConfigParser(inline_comment_prefixes=("#", ";"))
    parser.read(ini_path, encoding="utf-8")

    password = os.environ.get("PUB400_PASSWORD") or parser.get(
        "connection", "password", fallback=""
    )
    if not password:
        raise FrameworkError(
            "No password found. Set PUB400_PASSWORD or add 'password' "
            "under [connection] in config.ini."
        )

    dll_dirs = [d.strip() for d in parser.get("emulator", "dll_dirs", fallback="").split(",")
                if d.strip()]

    size = parser.get("emulator", "screen_size", fallback="27x132").lower()
    try:
        srows, scols = (int(v) for v in size.split("x"))
    except ValueError:
        srows, scols = 27, 132
    autodetect = parser.getboolean("emulator", "autodetect", fallback=True)

    return Config(
        session=parser.get("connection", "session", fallback="A"),
        host=parser.get("connection", "host", fallback="pub400.com"),
        user=parser.get("connection", "user"),
        password=password,
        library=parser.get("database", "library"),
        table=parser.get("database", "table"),
        key_column=parser.get("database", "key_column", fallback="USER_ID"),
        numeric_columns=[c.strip() for c in parser.get(
            "database", "numeric_columns", fallback="USER_ID").split(",") if c.strip()],
        dll_path=parser.get("emulator", "dll_path"),
        dll_dirs=dll_dirs,
        screen_rows=srows,
        screen_cols=scols,
        autodetect=autodetect,
        auto_launch=parser.getboolean("launch", "auto_launch", fallback=False),
        session_file=parser.get("launch", "session_file", fallback=""),
        launcher=parser.get("launch", "launcher", fallback=""),
        launch_timeout=parser.getfloat("launch", "launch_timeout", fallback=90.0),
        show_window=parser.getboolean("launch", "show_window", fallback=True),
        maximize_window=parser.getboolean("launch", "maximize_window", fallback=True),
        close_emulator=parser.getboolean("launch", "close_emulator", fallback=True),
        slowmo=parser.getfloat("runtime", "slowmo", fallback=1.0),
        trace=parser.getboolean("runtime", "trace", fallback=True),
        wait_retries=parser.getint("runtime", "wait_retries", fallback=8),
        wait_interval=parser.getfloat("runtime", "wait_interval", fallback=0.4),
        report_dir=parser.get("runtime", "report_dir", fallback="reports"),
        data_dir=parser.get("runtime", "data_dir", fallback="data"),
        test_data=parser.get("runtime", "test_data", fallback="users_testdata.csv"),
    )
