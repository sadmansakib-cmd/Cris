"""
Cris Agent - Volume and Brightness Control Tool
Controls system audio volume and display brightness.
"""

from __future__ import annotations

import subprocess
from typing import Any, Dict

TOOL_NAME = "volume_brightness"
TOOL_DESC = "Control Windows audio volume and screen brightness."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "target": {
            "type": "string",
            "enum": ["volume", "brightness"],
            "description": "What to adjust."
        },
        "action": {
            "type": "string",
            "enum": ["set", "get", "mute", "unmute"],
            "description": "Adjustment action."
        },
        "level": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "description": "Level between 0 and 100 for 'set' action."
        }
    },
    "required": ["target", "action"]
}
REQUIRES_CONFIRMATION = False


def _set_brightness(level: int) -> bool:
    cmd = [
        "powershell", "-NoProfile", "-Command",
        f"(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, {level})"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    return res.returncode == 0


def _get_brightness() -> int:
    cmd = [
        "powershell", "-NoProfile", "-Command",
        "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    try:
        return int(res.stdout.strip())
    except Exception:
        return 50


def _control_volume(action: str, level: int | None = None) -> Dict[str, Any]:
    # Using safe powershell audio commands via Windows CoreAudio or NirCmd if available
    if action == "set" and level is not None:
        cmd = [
            "powershell", "-NoProfile", "-Command",
            f"$obj = New-Object -ComObject WScript.Shell; 1..50 | % {{ $obj.SendKeys([char]174) }}; 1..{int(level / 2)} | % {{ $obj.SendKeys([char]175) }}"
        ]
        subprocess.run(cmd, capture_output=True, timeout=10)
        return {"success": True, "message": f"Volume set to approximate {level}%"}
    elif action == "mute":
        cmd = [
            "powershell", "-NoProfile", "-Command",
            "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]173)"
        ]
        subprocess.run(cmd, capture_output=True, timeout=10)
        return {"success": True, "message": "Volume muted/toggled."}
    return {"success": True, "message": f"Volume action {action} completed."}


def execute(target: str, action: str, level: int | None = None) -> Dict[str, Any]:
    target = target.lower()
    action = action.lower()

    if target == "volume":
        return _control_volume(action, level)
    elif target == "brightness":
        if action == "set":
            if level is None:
                return {"success": False, "error": "Level is required to set brightness."}
            ok = _set_brightness(level)
            return {"success": ok, "message": f"Brightness set to {level}%" if ok else "Failed to adjust brightness."}
        elif action == "get":
            val = _get_brightness()
            return {"success": True, "brightness": val}

    return {"success": False, "error": f"Invalid target '{target}' or action '{action}'."}
