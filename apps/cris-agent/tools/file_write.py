"""
Cris Agent - File Write Tool
Writes text content to a file inside allowed roots.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict
from config import AppConfig
from core.config_loader import load_config

TOOL_NAME = "file_write"
TOOL_DESC = "Create or overwrite a file with text content inside allowed folders."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "file_path": {
            "type": "string",
            "description": "Path to the destination file."
        },
        "content": {
            "type": "string",
            "description": "Text content to write."
        },
        "append": {
            "type": "boolean",
            "description": "Append to file instead of overwriting (default: false)."
        }
    },
    "required": ["file_path", "content"]
}
REQUIRES_CONFIRMATION = False


def execute(file_path: str, content: str, append: bool = False, config: AppConfig | None = None) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    target = Path(file_path).resolve()
    if not config.is_path_allowed(target):
        return {
            "success": False,
            "error": f"Access Denied: Path '{target}' is outside allowed directories."
        }

    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        mode = "a" if append else "w"
        with open(target, mode, encoding="utf-8") as f:
            f.write(content)
        return {
            "success": True,
            "file_path": str(target),
            "bytes_written": len(content.encode("utf-8")),
            "message": f"Successfully {'appended to' if append else 'wrote'} {target.name}."
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to write file: {e}"}
