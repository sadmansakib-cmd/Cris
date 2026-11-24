"""
Cris Agent - Clipboard Tool
Reads and writes text to the Windows system clipboard safely.
"""

from __future__ import annotations

import ctypes
from typing import Any, Dict

TOOL_NAME = "clipboard"
TOOL_DESC = "Read or write text to the Windows clipboard."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["read", "write"],
            "description": "Whether to read or write clipboard contents."
        },
        "text": {
            "type": "string",
            "description": "Text to write to clipboard (required if action is 'write')."
        }
    },
    "required": ["action"]
}
REQUIRES_CONFIRMATION = False


def execute(action: str, text: str = "") -> Dict[str, Any]:
    action = action.lower()
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32

    # CF_UNICODETEXT = 13
    CF_UNICODETEXT = 13

    if action == "read":
        if not user32.OpenClipboard(None):
            return {"success": False, "error": "Could not open clipboard."}
        try:
            h_glb = user32.GetClipboardData(CF_UNICODETEXT)
            if not h_glb:
                return {"success": True, "text": ""}
            kernel32.GlobalLock.restype = ctypes.c_wchar_p
            ptr = kernel32.GlobalLock(h_glb)
            content = str(ptr) if ptr else ""
            kernel32.GlobalUnlock(h_glb)
            return {"success": True, "text": content}
        finally:
            user32.CloseClipboard()

    elif action == "write":
        if not user32.OpenClipboard(None):
            return {"success": False, "error": "Could not open clipboard."}
        try:
            user32.EmptyClipboard()
            # GMEM_MOVEABLE = 0x0002
            data_bytes = (text + "\0").encode("utf-16le")
            h_glb = kernel32.GlobalAlloc(0x0002, len(data_bytes))
            kernel32.GlobalLock.restype = ctypes.c_void_p
            ptr = kernel32.GlobalLock(h_glb)
            ctypes.memmove(ptr, data_bytes, len(data_bytes))
            kernel32.GlobalUnlock(h_glb)
            user32.SetClipboardData(CF_UNICODETEXT, h_glb)
            return {"success": True, "message": "Text copied to clipboard."}
        finally:
            user32.CloseClipboard()

    return {"success": False, "error": f"Unknown clipboard action: {action}"}
