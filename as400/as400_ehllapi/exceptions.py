"""Custom exceptions.

One exception type per failure mode so callers (and the reporter) can react
precisely instead of catching a bare ``Exception`` and guessing what broke.
"""


class FrameworkError(Exception):
    """Base class for every error raised by this framework."""


class EmulatorError(FrameworkError):
    """The EHLLAPI DLL could not be loaded, or a raw EHLLAPI call failed."""


class SessionConnectError(FrameworkError):
    """Could not attach to the requested 5250 session short name."""


class SendKeyError(FrameworkError):
    """A Send Key (3) call was rejected by the host (keyboard inhibited, etc.)."""


class ScreenTimeoutError(FrameworkError):
    """Expected text never appeared on the presentation space within the retries."""


class SignOnError(FrameworkError):
    """Sign-on did not reach a command entry screen (bad credentials / locked profile)."""


class NavigationError(FrameworkError):
    """Could not reach the expected command line to continue."""
    

class CommandTooLongError(NavigationError):
    """The command does not fit in the IBM i command line field."""
