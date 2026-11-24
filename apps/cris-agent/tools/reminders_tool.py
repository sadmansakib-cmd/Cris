"""
Cris Agent - Reminders Tool
Schedules reminders in SQLite memory and displays Windows toast notifications.
"""

from __future__ import annotations

import subprocess
from typing import Any, Dict, Optional
from config import AppConfig
from core.config_loader import load_config
from memory.sqlite_store import SQLiteStore

TOOL_NAME = "reminders"
TOOL_DESC = "Manage reminders with Windows toast notifications: add, list, or complete."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["add", "list", "complete"],
            "description": "Reminder action."
        },
        "message": {
            "type": "string",
            "description": "Reminder text description."
        },
        "due_at": {
            "type": "string",
            "description": "Due time or date (ISO format or descriptive string, e.g. '2026-11-25 15:00')."
        },
        "reminder_id": {
            "type": "integer",
            "description": "ID of reminder to mark complete."
        }
    },
    "required": ["action"]
}
REQUIRES_CONFIRMATION = False


def _send_windows_toast(title: str, message: str) -> None:
    """Send native Windows toast notification."""
    try:
        from win10toast import ToastNotifier
        toaster = ToastNotifier()
        toaster.show_toast(title, message, duration=5, threaded=True)
    except Exception:
        # PowerShell notification fallback
        ps_script = f"""
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $textNodes = $template.GetElementsByTagName("text")
        $textNodes.Item(0).AppendChild($template.CreateTextNode('{title}')) | Out-Null
        $textNodes.Item(1).AppendChild($template.CreateTextNode('{message}')) | Out-Null
        $notification = [Windows.UI.Notifications.ToastNotification]::new($template)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Cris").Show($notification)
        """
        try:
            subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, timeout=5)
        except Exception:
            pass


def execute(
    action: str,
    message: str = "",
    due_at: str = "",
    reminder_id: Optional[int] = None,
    config: Optional[AppConfig] = None
) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    store = SQLiteStore(config.sqlite_db_path)
    action = action.lower()

    if action == "add":
        if not message:
            return {"success": False, "error": "Message is required to set a reminder."}
        due = due_at or "Now"
        rid = store.add_reminder(message, due)
        _send_windows_toast("Cris Reminder Scheduled", f"{message} (Due: {due})")
        return {"success": True, "reminder_id": rid, "message": f"Reminder #{rid} set for: {due}"}

    elif action == "list":
        reminders = store.list_reminders()
        return {"success": True, "count": len(reminders), "reminders": reminders}

    elif action == "complete":
        if reminder_id is None:
            return {"success": False, "error": "reminder_id is required."}
        ok = store.update_reminder_status(reminder_id, "completed")
        return {"success": ok, "message": f"Marked reminder #{reminder_id} completed." if ok else "Not found."}

    return {"success": False, "error": f"Unknown action: {action}"}
