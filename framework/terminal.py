"""IBM i-aware terminal, built on the raw EHLLAPI session.

Adds the concepts the host actually has — signing on, running a command from
the command line, clearing 'Press Enter to continue' panels, and waiting for
specific text to appear — so the layers above read like host interactions
rather than keystroke soup.
"""
import ctypes
import os
import subprocess
import time
from ctypes import wintypes
from typing import List, Optional

from .config import Config
from .ehllapi import EhllapiSession
from .exceptions import (CommandTooLongError, EmulatorError, NavigationError,
                         ScreenTimeoutError, SessionConnectError, SignOnError)
from .logger import get_logger

log = get_logger("terminal")

def esc(text: str) -> str:
    """Escape '@' for SendKey — '@' is EHLLAPI's mnemonic escape, so a literal
    '@' (e.g. in an email address) must be doubled to '@@'."""
    return text.replace("@", "@@")

# Send Key mnemonics
ENTER = "@E"
TAB   = "@T"
F3    = "@3"
F12   = "@c"
CLEAR = "@C"


class Terminal:
    """Session lifecycle + IBM i navigation primitives."""

    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.session = EhllapiSession(
            dll_path=cfg.dll_path,
            dll_dirs=cfg.dll_dirs,
            slowmo=cfg.slowmo,
            trace=cfg.trace,
            rows=cfg.screen_rows,
            cols=cfg.screen_cols,
            autodetect=cfg.autodetect,
        )

    # ------------------------------------------------------------ lifecycle
    def open(self) -> None:
        """Attach to the session; if it is not open, launch the saved .hod first."""
        try:
            self.session.connect(self.cfg.session)
        except SessionConnectError:
            if not self.cfg.auto_launch:
                raise
            log.info("Session %s not open; launching %s",
                     self.cfg.session, self.cfg.session_file)
            self._launch_session()
            self._connect_when_ready()
        if self.cfg.show_window:
            self._bring_to_front()

    def _bring_to_front(self) -> None:
        """Restore the ACS emulator window and raise it so the run can be watched."""
        hwnd = self._find_window()
        if hwnd is None:
            log.warning("Could not find the ACS session window to bring to front.")
            return
        user32 = ctypes.windll.user32
        # SW_MAXIMIZE fills the screen (ACS scales the font to the window);
        # SW_RESTORE just un-minimises to the size saved in the .hod
        user32.ShowWindow(hwnd, 3 if self.cfg.maximize_window else 9)
        user32.SetForegroundWindow(hwnd)
        log.info("Showing emulator window for session %s", self.cfg.session)

    def _find_window(self):
        """Return the ACS session window handle, or None.

        ACS is a Java app, so its frames have the window class 'SunAwtFrame'; the
        session window's title carries the host / session name.
        """
        user32 = ctypes.windll.user32
        needles = (self.cfg.host.lower(), f"{self.cfg.session.lower()} -")
        found = []

        @ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
        def visit(hwnd, _):
            cls = ctypes.create_unicode_buffer(64)
            user32.GetClassNameW(hwnd, cls, 64)
            if cls.value == "SunAwtFrame":
                title = ctypes.create_unicode_buffer(256)
                user32.GetWindowTextW(hwnd, title, 256)
                if any(n in title.value.lower() for n in needles):
                    found.append(hwnd)
            return True

        user32.EnumWindows(visit, 0)
        return found[0] if found else None

    def _launch_session(self) -> None:
        if not os.path.isfile(self.cfg.session_file):
            raise EmulatorError(
                f"Saved session file not found: {self.cfg.session_file}. In the "
                "ACS 5250 window use File > Save As... to save it there, or fix "
                "session_file under [launch] in config.ini."
            )
        if self.cfg.launcher and os.path.isfile(self.cfg.launcher):
            # same as double-clicking the .hod: the launcher takes just the file.
            # ('/plugin=5250' would start a blank session and demand '/system'.)
            subprocess.Popen([self.cfg.launcher, self.cfg.session_file])
        else:
            os.startfile(self.cfg.session_file)      # .hod file association

    def _connect_when_ready(self) -> None:
        """Poll until the new session accepts EHLLAPI and shows a usable screen."""
        deadline = time.monotonic() + self.cfg.launch_timeout
        while True:
            try:
                self.session.connect(self.cfg.session)
                break
            except SessionConnectError:
                if time.monotonic() > deadline:
                    raise SessionConnectError(
                        f"Launched {self.cfg.session_file} but session "
                        f"'{self.cfg.session}' did not become available within "
                        f"{self.cfg.launch_timeout:.0f}s. Check that the saved "
                        "session's short name matches [connection] session."
                    )
                time.sleep(2)
        # the emulator window is up; give the host time to paint the sign-on screen
        remaining = max(deadline - time.monotonic(), self.cfg.wait_interval)
        self.wait_for_any(["Password", "===>"],
                          retries=int(remaining / self.cfg.wait_interval) + 1)

    def close(self) -> None:
        self.session.disconnect()

    # -------------------------------------------------------- screen helpers
    def screen(self) -> str:
        return self.session.screen_text()

    def contains(self, text: str) -> bool:
        return text.lower() in self.screen().lower()

    def wait_for(self, text: str, retries: Optional[int] = None,
                 interval: Optional[float] = None) -> str:
        retries = self.cfg.wait_retries if retries is None else retries
        interval = self.cfg.wait_interval if interval is None else interval
        for _ in range(retries):
            self.session.wait()
            scr = self.screen()
            if text.lower() in scr.lower():
                return scr
            time.sleep(interval)
        raise ScreenTimeoutError(f"'{text}' did not appear within {retries} retries")

    def wait_for_any(self, texts: List[str], retries: Optional[int] = None,
                     interval: Optional[float] = None) -> str:
        retries = self.cfg.wait_retries if retries is None else retries
        interval = self.cfg.wait_interval if interval is None else interval
        low = [t.lower() for t in texts]
        for _ in range(retries):
            self.session.wait()
            scr = self.screen().lower()
            for i, needle in enumerate(low):
                if needle in scr:
                    return texts[i]
            time.sleep(interval)
        raise ScreenTimeoutError(f"None of {texts} appeared within {retries} retries")

    # ------------------------------------------------------------ IBM i acts
    def sign_on(self) -> None:
        self.session.wait()
        if not self.contains("Password"):
            log.info("Sign-on screen not shown; assuming already signed on.")
            return
        log.info("Signing on as %s", self.cfg.user)
        self.session.send(esc(self.cfg.user) + TAB)
        self.session.send(esc(self.cfg.password) + ENTER)
        self._clear_startup_panels()
        if not self.wait_for_command_entry():
            raise SignOnError(
                "Did not reach a command entry screen after sign-on. Check the "
                "credentials, and that the profile is not disabled on pub400.com."
            )

    def _clear_startup_panels(self, max_panels: int = 4) -> None:
        """PUB400 can show message / 'press Enter' panels before the menu."""
        for _ in range(max_panels):
            self.session.wait()
            scr = self.screen().lower()
            if "press enter to continue" in scr or "display messages" in scr:
                self.session.send(ENTER)
            else:
                break

    def wait_for_command_entry(self, retries: Optional[int] = None) -> bool:
        try:
            self.wait_for_any(["Selection or command", "===>", "Main Menu"],
                              retries=retries)
            return True
        except ScreenTimeoutError:
            return False

    def run_command(self, command: str) -> None:
        """Run a command on the IBM i command line ('===>').

        Set Cursor is unreliable on some emulator builds, so we don't depend on
        it: on a menu the command line is the cursor's HOME field, so we try
        (a) it's already there, (b) Set Cursor, (c) the Home key -- then verify.
        """
        row_idx, col = self._command_line_location()
        if row_idx is None:
            raise NavigationError(
                "No command line ('===>') on the current screen. Navigate the "
                "emulator to the IBM i Main Menu (press F3 until 'Selection or "
                "command' shows), then run again."
            )
        if not self._cursor_on(row_idx):
            self.session.set_cursor(row_idx, col)     # try direct positioning
        if not self._cursor_on(row_idx):
            self.session.send("@0")                   # Home key -> home input field
        if not self._cursor_on(row_idx):
            raise NavigationError(
                f"Could not reach the command line (row {row_idx}). Start from the "
                "Main Menu so the command line is the home field, then re-run."
            )
        # IBM i leaves a failed command in the field; typing over it only replaces
        # the first N characters, so the tail of the old command would be appended.
        # Home (start of the field) + Erase EOF clears the whole field first.
        self.session.send("@0@F")
        capacity = (self.session.cols - col + 1) + (self.session.cols - 1)
        if len(command) > capacity:
            raise CommandTooLongError(
                f"Command is {len(command)} characters; the command line holds "
                f"only {capacity}. Shorten the statement."
            )
        log.info("CMD: %s  (command line row %d)", command, row_idx)
        self.session.send(esc(command) + ENTER)
        self.session.wait()

    def _command_line_location(self):
        """Return (row, col) just after '===>' on screen, or (None, None)."""
        for i, row in enumerate(self.session.screen_rows(), start=1):
            pos = row.find("===>")
            if pos != -1:
                return i, pos + 6
        return None, None

    def _cursor_on(self, row_idx: int) -> bool:
        cur = self.session.cursor_rc()
        return cur is not None and cur[0] == row_idx

    def is_main_menu(self) -> bool:
        return self.contains("IBM i Main Menu")

    def to_main_menu(self, max_steps: int = 6) -> None:
        """Back out of whatever is showing (SQL data, sub-menus) to the Main Menu."""
        for _ in range(max_steps):
            if self.is_main_menu():
                return
            if self.contains("Exit Interactive SQL"):
                self.session.send(ENTER)              # default option 1 = save and exit
            elif self.contains("Display Data"):
                self.session.send(F12)
            else:
                self.session.send(F3)
        if not self.is_main_menu():
            raise NavigationError("Could not return to the IBM i Main Menu.")

    def sign_off(self) -> None:
        """Run SIGNOFF from the Main Menu and verify the sign-on screen returns."""
        log.info("Signing off")
        self.to_main_menu()
        self.run_command("SIGNOFF")
        self.wait_for_any(["Your user name", "Password"])

    def close_emulator(self) -> None:
        """Close the ACS session window and verify EHLLAPI can no longer attach."""
        self.session.disconnect()
        hwnd = self._find_window()
        if hwnd is None:
            raise EmulatorError("ACS session window not found; cannot close it.")
        pid = wintypes.DWORD()
        ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        ctypes.windll.user32.PostMessageW(hwnd, 0x0010, 0, 0)   # WM_CLOSE
        disconnected = False
        for _ in range(self.cfg.wait_retries * 3):
            time.sleep(self.cfg.wait_interval)
            try:
                self.session.connect(self.cfg.session)
                self.session.disconnect()
            except SessionConnectError:
                disconnected = True
                break
        if not disconnected:
            raise EmulatorError(f"Session {self.cfg.session} is still available "
                                "after closing the emulator window.")
        # The ACS JVM outlives its window for a while; a launch during that time is
        # handed to the dying process and lost, so wait for it to really exit.
        self._wait_for_exit(pid.value, timeout=60)
        log.info("Emulator closed; session %s is disconnected.", self.cfg.session)

    @staticmethod
    def _wait_for_exit(pid: int, timeout: float) -> None:
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(0x00100000, False, pid)     # SYNCHRONIZE
        if not handle:
            return                                              # already gone
        try:
            if kernel32.WaitForSingleObject(handle, int(timeout * 1000)) != 0:
                log.warning("ACS process %d still running after %.0fs.", pid, timeout)
        finally:
            kernel32.CloseHandle(handle)
