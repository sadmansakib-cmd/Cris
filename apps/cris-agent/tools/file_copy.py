"""
Cris Agent - File Copy Tool
Copies files within allowed directories.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any, Dict
from config import AppConfig
from core.config_loader import load_config

TOOL_NAME = "file_copy"
TOOL_DESC = "Copy a file from one path to another within allowed directories."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "src_path": {
            "type": "string",
            "description": "Source file path."
        },
        "dest_path": {
            "type": "string",
            "description": "Destination file path or directory."
        }
    },
    "required": ["src_path", "dest_path"]
}
REQUIRES_CONFIRMATION = False


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
        shutil.copy2(src, dest)
        return {
            "success": True,
            "src": str(src),
            "dest": str(dest),
            "message": f"Copied {src.name} to {dest}."
        }
    except Exception as e:
        return {"success": False, "error": f"Copy failed: {e}"}
