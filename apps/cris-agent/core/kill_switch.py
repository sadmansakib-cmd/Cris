"""
Cris Agent - Global Kill Switch
Monitors hotkey (Ctrl+Alt+Q) and triggers immediate emergency stop of PC automation.
"""

from __future__ import annotations

import logging
import threading
from typing import Callable, List, Optional

logger = logging.getLogger("cris.kill_switch")


class KillSwitch:
    _instance: Optional["KillSwitch"] = None
    _lock = threading.Lock()

    def __init__(self, hotkey: str = "ctrl+alt+q"):
        self.hotkey = hotkey.lower()
        self._aborted = threading.Event()
        self._callbacks: List[Callable[[], None]] = []
        self._listener_thread: Optional[threading.Thread] = None
        self._running = False

    @classmethod
    def get_instance(cls, hotkey: str = "ctrl+alt+q") -> "KillSwitch":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls(hotkey)
            return cls._instance

    def is_aborted(self) -> bool:
        return self._aborted.is_set()

    def trigger(self) -> None:
        """Trigger emergency abort immediately."""
        logger.warning(f"[KILL SWITCH] Emergency abort triggered via {self.hotkey}!")
        self._aborted.set()
        for cb in self._callbacks:
            try:
                cb()
            except Exception as e:
                logger.error(f"Error in kill switch callback: {e}")

    def reset(self) -> None:
        """Reset abort flag for next command."""
        self._aborted.clear()

    def register_callback(self, cb: Callable[[], None]) -> None:
        self._callbacks.append(cb)

    def start_listener(self) -> None:
        """Attempt to start keyboard hotkey listener in background thread."""
        if self._running:
            return
        self._running = True

        def _listen():
            try:
                import keyboard
                keyboard.add_hotkey(self.hotkey, self.trigger)
                keyboard.wait()
            except ImportError:
                logger.info("Optional package 'keyboard' not installed. Manual kill switch trigger available.")
            except Exception as e:
                logger.warning(f"Could not hook global hotkey {self.hotkey}: {e}")

        self._listener_thread = threading.Thread(target=_listen, daemon=True)
        self._listener_thread.start()
