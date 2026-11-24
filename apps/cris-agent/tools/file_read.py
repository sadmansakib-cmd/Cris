"""
Cris Agent - File Read Tool
Reads file contents within allowed roots safely.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict
from config import AppConfig
from core.config_loader import load_config

TOOL_NAME = "file_read"
TOOL_DESC = "Read text from a file within allowed directory boundaries."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "file_path": {
            "type": "string",
            "description": "Path to the file to read."
        },
        "max_lines": {
            "type": "integer",
            "description": "Maximum number of lines to read (default 500)."
        }
    },
    "required": ["file_path"]
}
REQUIRES_CONFIRMATION = False


def execute(file_path: str, max_lines: int = 500, config: AppConfig | None = None) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    target = Path(file_path).resolve()
    if not config.is_path_allowed(target):
        return {
            "success": False,
            "error": f"Access Denied: Path '{target}' is outside allowed directories."
        }

    if not target.exists():
        return {"success": False, "error": f"File does not exist: '{target}'"}
    if not target.is_file():
        return {"success": False, "error": f"Path is not a regular file: '{target}'"}

    try:
        with open(target, "r", encoding="utf-8", errors="replace") as f:
            lines = [f.readline() for _ in range(max_lines)]
            content = "".join(lines)
            return {
                "success": True,
                "file_path": str(target),
                "lines_read": len(lines),
                "content": content
            }
    except Exception as e:
        return {"success": False, "error": f"Failed to read file: {e}"}
