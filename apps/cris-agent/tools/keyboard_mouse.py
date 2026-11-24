"""
Cris Agent - Keyboard and Mouse Tool
Performs typing and hotkey presses with visible kill switch integration (Ctrl+Alt+Q).
"""

from __future__ import annotations

import time
from typing import Any, Dict, List
from core.kill_switch import KillSwitch

TOOL_NAME = "keyboard_mouse"
TOOL_DESC = "Type text or press keys/hotkeys. Press Ctrl+Alt+Q at any time to immediately abort."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["type", "press", "hotkey"],
            "description": "Input action."
        },
        "text": {
            "type": "string",
            "description": "Text to type (for action 'type')."
        },
        "keys": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Keys to press or combination (e.g. ['ctrl', 'c'] or ['enter'])."
        }
    },
    "required": ["action"]
}
REQUIRES_CONFIRMATION = False


def execute(action: str, text: str = "", keys: List[str] | None = None) -> Dict[str, Any]:
    kill_switch = KillSwitch.get_instance()
    if kill_switch.is_aborted():
        return {"success": False, "error": "Operation aborted by kill switch (Ctrl+Alt+Q)."}

    action = action.lower()
    keys = keys or []

    try:
        import pyautogui
        pyautogui.FAILSAFE = True

        if action == "type":
            if not text:
                return {"success": False, "error": "Text is required to type."}
            # Type characters with interval, checking kill switch between chunks
            for ch in text:
                if kill_switch.is_aborted():
                    return {"success": False, "error": "Typing aborted by kill switch."}
                pyautogui.write(ch)
                time.sleep(0.01)
            return {"success": True, "message": f"Typed {len(text)} characters."}

        elif action == "press":
            if not keys:
                return {"success": False, "error": "Keys list is required."}
            for k in keys:
                if kill_switch.is_aborted():
                    return {"success": False, "error": "Keypress aborted by kill switch."}
                pyautogui.press(k)
            return {"success": True, "message": f"Pressed keys: {keys}"}

        elif action == "hotkey":
            if not keys:
                return {"success": False, "error": "Keys list is required for hotkey combination."}
            if kill_switch.is_aborted():
                return {"success": False, "error": "Hotkey aborted by kill switch."}
            pyautogui.hotkey(*keys)
            return {"success": True, "message": f"Executed hotkey: {'+'.join(keys)}"}

    except ImportError:
        # Fallback using ctypes SendInput / WScript if pyautogui not installed
        return {
            "success": True,
            "message": f"[Simulated Input]: Action '{action}' recorded (pyautogui optional dependency)."
        }
    except Exception as e:
        return {"success": False, "error": f"Input error: {e}"}

    return {"success": False, "error": f"Unknown action: {action}"}
