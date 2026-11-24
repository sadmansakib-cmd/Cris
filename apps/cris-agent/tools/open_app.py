"""
Cris Agent - Open Application Tool
Launches authorized applications with strict allowlist and metacharacter validation.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict
from config import AppConfig
from core.config_loader import load_config

TOOL_NAME = "open_app"
TOOL_DESC = "Launch an authorized application on Windows. Only apps from the configured allowlist are permitted."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "app_name": {
            "type": "string",
            "description": "Name or executable of the application (e.g. notepad.exe, calc.exe, code.cmd)."
        }
    },
    "required": ["app_name"]
}
REQUIRES_CONFIRMATION = False


def execute(app_name: str, config: AppConfig | None = None) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    # Reject any shell metacharacters
    if re.search(r"[&;\|`\$<>!\"\n\r]", app_name):
        return {
            "success": False,
            "error": "Rejected: App name contains prohibited metacharacters."
        }

    clean_name = app_name.strip()
    if not config.is_app_allowed(clean_name):
        return {
            "success": False,
            "error": f"Access Denied: '{clean_name}' is not in the allowed application list. Allowed: {config.app_allowlist}"
        }

    # Locate executable
    target_path = shutil.which(clean_name) or clean_name

    try:
        # Strictly NO shell=True
        proc = subprocess.Popen([target_path], shell=False)
        return {
            "success": True,
            "message": f"Successfully launched '{clean_name}' (PID: {proc.pid})."
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to start application '{clean_name}': {e}"}
