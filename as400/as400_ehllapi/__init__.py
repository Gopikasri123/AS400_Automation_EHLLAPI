"""as400_ehllapi — EHLLAPI-driven IBM i 5250 green-screen automation library.

Install once (like adding the Selenium jar to a project), then import:

    pip install as400_ehllapi-1.0.0-py3-none-any.whl

    from as400_ehllapi import load_config, Terminal, StrSql
"""

__version__ = "1.0.0"

from .config import Config, load_config
from .csv_loader import load_cases
from .ehllapi import EhllapiSession
from .exceptions import (CommandTooLongError, EmulatorError, FrameworkError,
                         NavigationError, ScreenTimeoutError, SendKeyError,
                         SessionConnectError, SignOnError)
from .logger import get_logger, setup_logging
from .results import FAIL, PASS, SKIP, ResultCollector, StepResult
from .strsql import SqlResult, StrSql
from .terminal import CLEAR, ENTER, F3, F12, TAB, Terminal, esc

__all__ = [
    "__version__",
    # config / data / logging
    "Config", "load_config", "load_cases", "get_logger", "setup_logging",
    # emulator
    "EhllapiSession", "Terminal", "StrSql", "SqlResult", "esc",
    "ENTER", "CLEAR", "TAB", "F3", "F12",
    # results
    "StepResult", "ResultCollector", "PASS", "FAIL", "SKIP",
    # errors
    "FrameworkError", "EmulatorError", "SessionConnectError", "SendKeyError",
    "ScreenTimeoutError", "SignOnError", "NavigationError", "CommandTooLongError",
]
