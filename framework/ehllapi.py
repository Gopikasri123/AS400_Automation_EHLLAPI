"""Low-level EHLLAPI session driver.

A thin, well-documented ``ctypes`` wrapper over the single EHLLAPI entry point
``hllapi(func, buffer, length, retcode)``. Nothing above this layer should know
about raw function numbers — they speak in terms of keystrokes and screens.

Notes
-----
* This attaches to an ACS 5250 session that is ALREADY OPEN; it does not launch
  the emulator.
* Presentation-space geometry (24x80 vs 27x132) is detected at connect time via
  Query Session Status (22), so the rest of the framework never hardcodes a size.
"""
import ctypes
import os
import time
from ctypes import byref, c_int, create_string_buffer
from typing import List, Optional, Tuple

from .exceptions import EmulatorError, SendKeyError, SessionConnectError
from .logger import get_logger

log = get_logger("ehllapi")

# --- EHLLAPI function numbers (IBM Standard interface) ---
CONNECT_PS         = 1
DISCONNECT_PS      = 2
SEND_KEY           = 3
WAIT               = 4
COPY_PS            = 5
QUERY_CURSOR       = 7
SET_SESSION_PARMS  = 9
QUERY_SESSION_STAT = 22
SET_CURSOR         = 40

RC_OK = 0
RC_KEYBOARD_INHIBITED = 5


class EhllapiSession:
    """Attaches to ONE already-open ACS 5250 session by its short name."""

    def __init__(self, dll_path: str, dll_dirs: Optional[List[str]] = None,
                 slowmo: float = 0.0, trace: bool = False,
                 rows: int = 27, cols: int = 132, autodetect: bool = True):
        self.slowmo = slowmo
        self.trace = trace
        self.autodetect = autodetect
        self.rows, self.cols, self.ps_size = rows, cols, rows * cols
        self._connected_to: Optional[str] = None

        # Python 3.8+ ignores PATH when resolving a DLL's dependencies, so the
        # bridge folders must be registered explicitly for pcsapi32.dll to load.
        for directory in (dll_dirs or []):
            if os.path.isdir(directory):
                os.add_dll_directory(directory)

        if not os.path.exists(dll_path):
            raise EmulatorError(f"EHLLAPI DLL not found: {dll_path}")
        try:
            self._api = ctypes.WinDLL(dll_path).hllapi
        except OSError as exc:
            raise EmulatorError(
                f"Could not load {dll_path} ({exc}). "
                "Check the 32/64-bit match and that dll_dirs is correct."
            ) from exc

    # ------------------------------------------------------------------ raw
    def _call(self, func: int, data: bytes = b"", length: Optional[int] = None
              ) -> Tuple[bytes, int, int]:
        length = len(data) if length is None else length
        func_p = c_int(func)
        buf = create_string_buffer(data, max(length, 1))
        len_p = c_int(length)
        rc_p = c_int(0)
        self._api(byref(func_p), buf, byref(len_p), byref(rc_p))
        return buf.raw, len_p.value, rc_p.value

    def _tick(self, action: str, detail: str = "") -> None:
        """Trace one action (with cursor position) and honour slow-motion pacing."""
        if self.trace:
            rc = self.cursor_rc()
            loc = f"  @r{rc[0]},c{rc[1]}" if rc else ""
            log.info("%-9s %s%s", action, detail, loc)
        if self.slowmo:
            time.sleep(self.slowmo)

    # ------------------------------------------------------------ lifecycle
    def connect(self, short_name: str) -> None:
        _, _, rc = self._call(CONNECT_PS, short_name.encode("latin-1"))
        if rc != RC_OK:
            raise SessionConnectError(
                f"Connect to session '{short_name}' failed (rc={rc}). "
                "Is the ACS 5250 session open with that short name?"
            )
        self._connected_to = short_name
        if self.autodetect:
            self._detect_size(short_name)
        self.set_session_parms("TWAIT")   # block on wait() until the host is ready
        self._tick("CONNECT", f"session {short_name} ({self.rows}x{self.cols})")

    def disconnect(self) -> None:
        self._call(DISCONNECT_PS)
        self._connected_to = None

    def set_session_parms(self, parms: str) -> None:
        self._call(SET_SESSION_PARMS, parms.encode("latin-1"))

    # -------------------------------------------------------------- geometry
    def _detect_size(self, short_name: str) -> None:
        # Query Session Status (22) returns rows/cols, but the field offsets differ
        # between the Standard and Enhanced EHLLAPI layouts, and endianness varies
        # by build. Rather than trust one layout, try the known ones and accept the
        # first interpretation that yields a real IBM i display size; otherwise keep
        # the configured screen_size.
        data = short_name.encode("latin-1") + b"\x00" * 23
        raw, _, rc = self._call(QUERY_SESSION_STAT, data, 24)
        if rc != RC_OK or len(raw) < 18:
            return
        valid_rows, valid_cols = (24, 27, 43), (80, 132)
        for r_off, c_off in ((11, 13), (14, 16)):        # Standard, then Enhanced
            for endian in ("little", "big"):
                r = int.from_bytes(raw[r_off:r_off + 2], endian)
                c = int.from_bytes(raw[c_off:c_off + 2], endian)
                if r in valid_rows and c in valid_cols:
                    self.rows, self.cols, self.ps_size = r, c, r * c
                    return
        if self.trace:
            log.info("size autodetect inconclusive (raw=%s); keeping %dx%d",
                     raw[:20].hex(), self.rows, self.cols)

    # ----------------------------------------------------------------- input
    def send(self, keys: str) -> None:
        """Send a keystroke string (mnemonics: @E Enter, @T Tab, @3 F3, @C Clear)."""
        _, _, rc = self._call(SEND_KEY, keys.encode("latin-1"))
        if rc == RC_KEYBOARD_INHIBITED:
            self.wait()                          # let the host catch up, retry once
            _, _, rc = self._call(SEND_KEY, keys.encode("latin-1"))
        if rc != RC_OK:
            raise SendKeyError(f"Send Key failed (rc={rc}) for {keys!r}")
        self.wait()
        self._tick("SEND", repr(keys))

    def set_cursor(self, row: int, col: int) -> None:
        pos = (row - 1) * self.cols + col
        self._call(SET_CURSOR, b"", pos)

    # ---------------------------------------------------------------- output
    def wait(self) -> int:
        """Wait for the host; rc 0 = ready, 4 = timeout, 5 = still inhibited."""
        return self._call(WAIT)[2]

    def cursor_rc(self) -> Optional[Tuple[int, int]]:
        _, pos, rc = self._call(QUERY_CURSOR)
        if rc == RC_OK and pos > 0 and self.cols:
            return ((pos - 1) // self.cols + 1, (pos - 1) % self.cols + 1)
        return None

    def screen_rows(self) -> List[str]:
        raw, ln, _ = self._call(COPY_PS, b"", self.ps_size)
        text = raw[:ln].decode("latin-1", errors="replace")
        return [text[i * self.cols:(i + 1) * self.cols] for i in range(self.rows)]

    def screen_text(self) -> str:
        return "\n".join(row.rstrip() for row in self.screen_rows())
