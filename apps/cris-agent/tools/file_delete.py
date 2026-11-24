"""
Cris Agent - File Delete Tool
Sends files to the Windows Recycle Bin (send2trash). Never permanent deletion!
Requires explicit user confirmation.
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any, Dict
from config import AppConfig
from core.config_loader import load_config

TOOL_NAME = "file_delete"
TOOL_DESC = "Send a file or folder to the Windows Recycle Bin. Requires user confirmation. Never permanently deletes."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "file_path": {
            "type": "string",
            "description": "Path to the file or directory to send to the Recycle Bin."
        }
    },
    "required": ["file_path"]
}
REQUIRES_CONFIRMATION = True


def CONFIRMATION_DESCRIPTION_FN(args: Dict[str, Any]) -> str:
    return f"Move '{args.get('file_path')}' to the Windows Recycle Bin"


def execute(file_path: str, config: AppConfig | None = None) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    target = Path(file_path).resolve()
    if not config.is_path_allowed(target):
        return {
            "success": False,
            "error": f"Access Denied: Path '{target}' is outside allowed directories."
        }

    if not target.exists():
        return {"success": False, "error": f"File does not exist: {target}"}

    # First attempt: send2trash library
    try:
        from send2trash import send2trash
        send2trash(str(target))
        return {
            "success": True,
            "path": str(target),
            "message": f"Safely moved '{target.name}' to the Windows Recycle Bin."
        }
    except ImportError:
        # PowerShell COM fallback: Send to Recycle Bin via VisualBasic FileSystem
        ps_script = f"""
        Add-Type -AssemblyName Microsoft.VisualBasic
        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile(
            '{str(target)}',
            [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
            [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
        )
        """
        res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True, timeout=10)
        if res.returncode == 0 and not target.exists():
            return {
                "success": True,
                "path": str(target),
                "message": f"Safely moved '{target.name}' to the Windows Recycle Bin (via Shell)."
            }
        return {"success": False, "error": f"Recycle Bin deletion failed: {res.stderr}"}
    except Exception as e:
        return {"success": False, "error": f"Failed to recycle file: {e}"}
