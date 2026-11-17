"""Interactive SQL (STRSQL) driver.

Turns SQL strings into on-screen actions on the 'Enter SQL Statements' screen
and captures what the host shows back:

* INSERT / UPDATE / DELETE -> the completion message just above '===>'
  (e.g. '1 rows inserted in USERS in GOPIKAS1.').
* SELECT -> the 'Display Data' screen, read in full (shifting right past the
  80-column window when the row is wider) and parsed into one dict per row.

Emulator quirks this driver works around (verified on PUB400 / ACS):

* STRSQL keeps a failed statement in the entry area, and each entry line is a
  separate field. Set Cursor is a no-op and Home lands wherever the host put
  the cursor, so the entry area is cleared field-by-field with Tab + Erase EOF.
* PUB400 formats numbers with '.' as the thousands separator ('9.001').
"""
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .exceptions import NavigationError
from .logger import get_logger
from .terminal import ENTER, F3, F12, TAB, Terminal, esc

log = get_logger("strsql")

ERASE_EOF = "@F"
HOME, NEWLINE, BACKTAB = "@0", "@N", "@B"
MAX_ENTRY_LINES = 10          # more than STRSQL ever shows; extra tabs just wrap


@dataclass
class SqlResult:
    """The outcome of one executed statement."""
    statement: str
    screen: str                      # presentation space after execution
    message: str                     # completion / error message
    rows: Optional[List[Dict[str, Optional[str]]]] = None   # SELECT only
    columns: List[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        low = self.message.lower()
        return any(k in low for k in ("rows inserted", "rows updated",
                                      "rows deleted", "run complete"))


class StrSql:
    """Drives one interactive SQL session started from the Main Menu."""

    def __init__(self, terminal: Terminal):
        self.t = terminal
        self.s = terminal.session

    # ------------------------------------------------------------ lifecycle
    def open(self) -> None:
        """From the Main Menu, start STRSQL and wait for the entry screen."""
        if self._on_entry_screen():
            return
        self.t.to_main_menu()
        self.t.run_command("STRSQL NAMING(*SQL) COMMIT(*NONE)")
        self.t.wait_for("Enter SQL Statements")
        if self._entry_row() is None:
            raise NavigationError("STRSQL started but no '===>' prompt is shown.")

    def close(self) -> None:
        """F3 -> 'Exit Interactive SQL' -> option 1 (save and exit) -> menu."""
        if self.t.contains("Display Data"):
            self.s.send(F12)
        self.s.send(F3)
        self.t.wait_for("Exit Interactive SQL")
        self.s.send(ENTER)                    # option 1 is pre-filled
        self.t.wait_for("Selection or command")

    # ------------------------------------------------------------ execution
    def execute(self, statement: str) -> SqlResult:
        log.info("SQL: %s", statement)
        if self.t.contains("Display Data"):
            self.s.send(F12)
        self._clear_entry()
        self.s.send(esc(statement) + ENTER)
        self.s.wait()
        if self.t.contains("Confirm Statement"):
            self.s.send(ENTER)

        screen = self.t.screen()
        if "Display Data" in screen:
            columns, rows = self._read_display_data()
            result = SqlResult(statement, screen, "SELECT statement run complete.",
                               rows, columns)
            log.info("  -> %d row(s): %s", len(rows), rows)
            self.s.send(F12)                   # back to the entry screen
        else:
            result = SqlResult(statement, screen, self._last_message())
            log.info("  -> %s", result.message)
        return result

    # ---------------------------------------------------------- entry area
    def _on_entry_screen(self) -> bool:
        return self.t.contains("Enter SQL Statements")

    def _entry_row(self) -> Optional[int]:
        for i, row in enumerate(self.s.screen_rows(), start=1):
            if row.startswith(" ===>"):
                return i
        return None

    def _clear_entry(self) -> None:
        """Erase every entry line, then park the cursor at the start of line 1."""
        top = self._entry_row()
        if top is None:
            raise NavigationError("Not on the STRSQL entry screen ('===>' missing).")
        self.s.send(HOME + NEWLINE + BACKTAB)          # onto a line start
        self.s.send((ERASE_EOF + TAB) * MAX_ENTRY_LINES)
        for _ in range(MAX_ENTRY_LINES):
            cur = self.s.cursor_rc()
            if cur and cur[0] == top:
                return
            self.s.send(TAB)
        raise NavigationError("Could not place the cursor on the SQL entry line.")

    def _last_message(self) -> str:
        """The host message is the line just above '===>' (newest history entry)."""
        rows = self.s.screen_rows()
        top = self._entry_row()
        if top is None or top < 2:
            return rows[-1].strip()
        return rows[top - 2].strip()

    # ----------------------------------------------------------- data screen
    def _read_display_data(self):
        """Return (column names, rows) from the 'Display Data' screen.

        The screen shows (cols - 1) data positions at a time (79 at 24x80, 131
        once STRSQL switches the session to 27x132); wider results are read by
        typing successive offsets into 'Shift to column' and stitching.
        """
        width = self._data_width()
        rows = self.s.screen_rows()          # also refreshes the session geometry
        count = self._data_row_count(rows)
        span = self.s.cols - 1
        header, lines = "", [""] * count
        start = 1
        while True:
            header += rows[4][1:span + 1].ljust(span)             # row 5 = headings
            for i in range(count):
                lines[i] += rows[5 + i][1:span + 1].ljust(span)   # rows 6.. = data
            start += span
            if start > width:
                break
            self.s.send(TAB + ERASE_EOF + str(start) + ENTER)   # 'Shift to column'
            rows = self.s.screen_rows()
        header, lines = header[:width], [ln[:width] for ln in lines]
        return self._parse(header, lines)

    def _data_width(self) -> int:
        m = re.search(r"Data width[ .]*:\s*(\d+)", self.t.screen())
        return int(m.group(1)) if m else 79

    @staticmethod
    def _data_row_count(rows: List[str]) -> int:
        """Data rows sit between the headings and '*** End of data ***'.

        The last three screen rows hold the function keys and messages.
        """
        last = len(rows) - 3
        for i, row in enumerate(rows[5:last]):
            if "End of data" in row:
                return i
        return last - 5        # a full page; only the first page is read

    @staticmethod
    def _parse(header: str, lines: List[str]):
        """Split fixed-width lines at the column headings.

        Text columns are left-aligned under their heading; numbers are right-
        aligned and may start left of it, so a slice start is moved left while
        the data character just before it is not a space.
        """
        heads = [(m.start(), m.group()) for m in re.finditer(r"\S+(?: \S+)*", header)]
        columns = [name for _, name in heads]
        rows = []
        for line in lines:
            line = line.ljust(len(header))
            starts = []
            for pos, _ in heads:
                while pos > 0 and line[pos - 1] != " ":
                    pos -= 1
                starts.append(pos)
            values = {}
            for i, name in enumerate(columns):
                end = starts[i + 1] if i + 1 < len(starts) else len(line)
                value = line[starts[i]:end].strip()
                values[name] = None if value == "-" else value
            rows.append(values)
        return columns, rows
