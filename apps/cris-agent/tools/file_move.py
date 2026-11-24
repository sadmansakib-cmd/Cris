"""
Cris Agent - File Move Tool
Moves files within allowed roots. Requires explicit user confirmation.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any, Dict
from config import AppConfig
from core.config_loader import load_config

TOOL_NAME = "file_move"
TOOL_DESC = "Move a file from source to destination within allowed directories. Requires confirmation."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "src_path": {
            "type": "string",
            "description": "Source path."
        },
        "dest_path": {
            "type": "string",
            "description": "Destination path."
        }
    },
    "required": ["src_path", "dest_path"]
}
REQUIRES_CONFIRMATION = True


def CONFIRMATION_DESCRIPTION_FN(args: Dict[str, Any]) -> str:
    return f"Move file '{args.get('src_path')}' to '{args.get('dest_path')}'"


def execute(src_path: str, dest_path: str, config: AppConfig | None = None) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    src = Path(src_path).resolve()
    dest = Path(dest_path).resolve()

    if not config.is_path_allowed(src) or not config.is_path_allowed(dest):
        return {
            "success": False,
            "error": "Access Denied: Both source and destination paths must be within allowed roots."
        }

    if not src.exists():
        return {"success": False, "error": f"Source file does not exist: {src}"}

    try:
        if dest.is_dir():
            dest = dest / src.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dest))
        return {
            "success": True,
            "src": str(src),
            "dest": str(dest),
            "message": f"Successfully moved '{src.name}' to '{dest}'."
        }
    except Exception as e:
        return {"success": False, "error": f"Move failed: {e}"}
