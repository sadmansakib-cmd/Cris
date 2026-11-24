"""
Cris Agent - Window Manager Tool
Lists, focuses, minimizes, or closes application windows on Windows.
"""

from __future__ import annotations

import ctypes
from ctypes import wintypes
from typing import Any, Dict, List

TOOL_NAME = "window_manager"
TOOL_DESC = "Manage open application windows: list, focus, minimize, or close."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["list", "focus", "minimize", "close"],
            "description": "Action to perform on window."
        },
        "title": {
            "type": "string",
            "description": "Window title substring to match (required for focus/minimize/close)."
        }
    },
    "required": ["action"]
}
REQUIRES_CONFIRMATION = False


def _get_open_windows() -> List[Dict[str, Any]]:
    windows = []
    user32 = ctypes.windll.user32

    def enum_windows_proc(hwnd, lParam):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buff, length + 1)
                title = buff.value.strip()
                if title:
                    windows.append({"hwnd": hwnd, "title": title})
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows(WNDENUMPROC(enum_windows_proc), 0)
    return windows


def execute(action: str, title: str = "") -> Dict[str, Any]:
    action = action.lower()
    windows = _get_open_windows()

    if action == "list":
        return {
            "success": True,
            "windows": [w["title"] for w in windows]
        }

    if not title:
        return {"success": False, "error": f"Title substring is required for action '{action}'."}

    matched = [w for w in windows if title.lower() in w["title"].lower()]
    if not matched:
        return {"success": False, "error": f"No open window found matching '{title}'."}

    target_hwnd = matched[0]["hwnd"]
    target_title = matched[0]["title"]
    user32 = ctypes.windll.user32

    if action == "focus":
        # SW_RESTORE = 9
        user32.ShowWindow(target_hwnd, 9)
        user32.SetForegroundWindow(target_hwnd)
        return {"success": True, "message": f"Focused window: '{target_title}'"}

    elif action == "minimize":
        # SW_MINIMIZE = 6
        user32.ShowWindow(target_hwnd, 6)
        return {"success": True, "message": f"Minimized window: '{target_title}'"}

    elif action == "close":
        # WM_CLOSE = 0x0010
        user32.PostMessageW(target_hwnd, 0x0010, 0, 0)
        return {"success": True, "message": f"Closed window: '{target_title}'"}

    return {"success": False, "error": f"Unknown action: {action}"}
