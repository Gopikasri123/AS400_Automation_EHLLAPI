"""Central logging: timestamped console output plus a per-run log file.

Every layer logs through here, so a single run produces one coherent, greppable
trace on disk under the report directory.
"""
import logging
import sys
from datetime import datetime
from pathlib import Path

_CONFIGURED = False


def setup_logging(report_dir: str = "reports", level: int = logging.INFO) -> logging.Logger:
    """Configure the root 'pub400' logger once; safe to call repeatedly."""
    global _CONFIGURED
    logger = logging.getLogger("pub400")
    if _CONFIGURED:
        return logger

    logger.setLevel(logging.DEBUG)
    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-7s | %(name)-14s | %(message)s",
        datefmt="%H:%M:%S",
    )

    console = logging.StreamHandler(sys.stdout)
    console.setLevel(level)
    console.setFormatter(fmt)
    logger.addHandler(console)

    Path(report_dir).mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_handler = logging.FileHandler(Path(report_dir) / f"run_{stamp}.log", encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    _CONFIGURED = True
    return logger


def get_logger(name: str = "pub400") -> logging.Logger:
    """Return a child logger; callers pass a short area name e.g. 'ehllapi'."""
    if name == "pub400" or name.startswith("pub400."):
        return logging.getLogger(name)
    return logging.getLogger(f"pub400.{name}")
