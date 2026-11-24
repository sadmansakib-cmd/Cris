"""
Cris Agent - Tasks Tool
Todo and project task tracking backed by SQLite.
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from config import AppConfig
from core.config_loader import load_config
from memory.sqlite_store import SQLiteStore

TOOL_NAME = "tasks"
TOOL_DESC = "Manage personal tasks and todos: add, list, update status, or delete."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["add", "list", "update", "delete"],
            "description": "Task operation."
        },
        "title": {
            "type": "string",
            "description": "Title of the task."
        },
        "description": {
            "type": "string",
            "description": "Detailed task description."
        },
        "priority": {
            "type": "string",
            "enum": ["low", "medium", "high"],
            "description": "Task priority level (default: medium)."
        },
        "status": {
            "type": "string",
            "enum": ["todo", "in_progress", "done"],
            "description": "Status filter or updated status."
        },
        "task_id": {
            "type": "integer",
            "description": "ID of task to update or delete."
        }
    },
    "required": ["action"]
}
REQUIRES_CONFIRMATION = False


def execute(
    action: str,
    title: str = "",
    description: str = "",
    priority: str = "medium",
    status: str = "todo",
    task_id: Optional[int] = None,
    config: Optional[AppConfig] = None
) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    store = SQLiteStore(config.sqlite_db_path)
    action = action.lower()

    if action == "add":
        if not title:
            return {"success": False, "error": "Title is required for a new task."}
        tid = store.add_task(title=title, description=description, priority=priority)
        return {"success": True, "task_id": tid, "message": f"Created task #{tid}: '{title}'"}

    elif action == "list":
        filter_status = status if status in ("todo", "in_progress", "done") else None
        tasks = store.list_tasks(status=filter_status)
        return {"success": True, "count": len(tasks), "tasks": tasks}

    elif action == "update":
        if task_id is None:
            return {"success": False, "error": "task_id is required to update a task."}
        ok = store.update_task_status(task_id, status)
        return {"success": ok, "message": f"Updated task #{task_id} status to '{status}'." if ok else "Task not found."}

    elif action == "delete":
        if task_id is None:
            return {"success": False, "error": "task_id is required to delete a task."}
        ok = store.delete_task(task_id)
        return {"success": ok, "message": f"Deleted task #{task_id}." if ok else "Task not found."}

    return {"success": False, "error": f"Unknown action: {action}"}
