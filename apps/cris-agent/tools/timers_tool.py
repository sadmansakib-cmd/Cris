"""
Cris Agent - Timers Tool
Countdown timers with background notification and alert chime.
"""

from __future__ import annotations

import threading
import time
import winsound
from typing import Any, Dict

TOOL_NAME = "timers"
TOOL_DESC = "Start countdown timers with toast notifications and chimes."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "seconds": {
            "type": "integer",
            "description": "Duration in seconds (e.g. 60 for 1 minute, 300 for 5 minutes)."
        },
        "label": {
            "type": "string",
            "description": "Label or reason for the timer (e.g. 'Coffee break', 'Call follow-up')."
        }
    },
    "required": ["seconds"]
}
REQUIRES_CONFIRMATION = False


def _timer_worker(seconds: int, label: str):
    time.sleep(seconds)
    try:
        # Beep notification (3 quick chimes)
        for _ in range(3):
            winsound.Beep(1000, 250)
            time.sleep(0.1)
    except Exception:
        pass
    from tools.reminders_tool import _send_windows_toast
    _send_windows_toast("Cris Timer Done!", f"Timer expired: {label} ({seconds}s)")


def execute(seconds: int, label: str = "Timer") -> Dict[str, Any]:
    if seconds <= 0:
        return {"success": False, "error": "Duration must be greater than 0 seconds."}

    t = threading.Thread(target=_timer_worker, args=(seconds, label), daemon=True)
    t.start()

    minutes = seconds / 60.0
    time_str = f"{minutes:.1f} minutes" if seconds >= 60 else f"{seconds} seconds"
    return {
        "success": True,
        "seconds": seconds,
        "label": label,
        "message": f"Timer set for {label} ({time_str}). I'll alert you when it expires."
    }
