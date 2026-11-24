"""
Cris Agent - Notes Tool
Create, search, list, and delete personal notes in SQLite memory.
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from config import AppConfig
from core.config_loader import load_config
from memory.sqlite_store import SQLiteStore

TOOL_NAME = "notes"
TOOL_DESC = "Manage personal notes in local memory: add, search, list, or delete notes."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["add", "search", "list", "delete"],
            "description": "Note management action."
        },
        "title": {
            "type": "string",
            "description": "Title of the note."
        },
        "content": {
            "type": "string",
            "description": "Content of the note (for 'add')."
        },
        "tags": {
            "type": "string",
            "description": "Comma-separated tags (for 'add')."
        },
        "query": {
            "type": "string",
            "description": "Search term (for 'search')."
        },
        "note_id": {
            "type": "integer",
            "description": "ID of the note to delete."
        }
    },
    "required": ["action"]
}
REQUIRES_CONFIRMATION = False


def execute(
    action: str,
    title: str = "",
    content: str = "",
    tags: str = "",
    query: str = "",
    note_id: Optional[int] = None,
    config: Optional[AppConfig] = None
) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    store = SQLiteStore(config.sqlite_db_path)
    action = action.lower()

    if action == "add":
        if not title:
            return {"success": False, "error": "Title is required to create a note."}
        nid = store.add_note(title=title, content=content, tags=tags)
        return {"success": True, "note_id": nid, "message": f"Saved note '{title}' (ID: {nid})."}

    elif action in ("list", "search"):
        notes = store.search_notes(query)
        return {"success": True, "count": len(notes), "notes": notes}

    elif action == "delete":
        if note_id is None:
            return {"success": False, "error": "note_id is required to delete a note."}
        ok = store.delete_note(note_id)
        return {"success": ok, "message": f"Deleted note ID {note_id}." if ok else "Note ID not found."}

    return {"success": False, "error": f"Unknown action: {action}"}
