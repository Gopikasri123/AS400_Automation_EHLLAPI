"""Data-driven input: read a test-case CSV into a list of ordered dicts.

Blank rows and rows whose first cell starts with '#' are skipped, so the data
files stay easy to comment and annotate.
"""
import csv
from pathlib import Path
from typing import Dict, List

from .exceptions import FrameworkError
from .logger import get_logger

log = get_logger("csv")


def load_cases(path: str) -> List[Dict[str, str]]:
    p = Path(path)
    if not p.exists():
        raise FrameworkError(f"Test data file not found: {p.resolve()}")

    rows: List[Dict[str, str]] = []
    with p.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for raw in reader:
            if not raw:
                continue
            first = (next(iter(raw.values())) or "").strip()
            if first.startswith("#"):
                continue
            if not any((v or "").strip() for v in raw.values()):
                continue
            rows.append({k: (v or "").strip() for k, v in raw.items()})

    log.info("Loaded %d cases from %s", len(rows), p.name)
    return rows
