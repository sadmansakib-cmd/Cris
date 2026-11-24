"""
Cris Agent - File Search Tool
Searches for files under allowed roots matching patterns.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List
from config import AppConfig
from core.config_loader import load_config

TOOL_NAME = "file_search"
TOOL_DESC = "Search for files by name or pattern inside allowed folders."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "pattern": {
            "type": "string",
            "description": "Filename pattern to match (e.g. '*.ts', 'config.*', 'report.pdf')."
        },
        "search_path": {
            "type": "string",
            "description": "Directory to search within (must be inside allowed_roots). Defaults to current workspace."
        },
        "max_results": {
            "type": "integer",
            "description": "Maximum number of file paths to return (default 50)."
        }
    },
    "required": ["pattern"]
}
REQUIRES_CONFIRMATION = False


def execute(pattern: str, search_path: str = "", max_results: int = 50, config: AppConfig | None = None) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    base_search = Path(search_path).resolve() if search_path else Path(config.allowed_roots[0]).resolve()

    if not config.is_path_allowed(base_search):
        return {
            "success": False,
            "error": f"Path '{base_search}' is outside permitted directory boundaries: {config.allowed_roots}"
        }

    matches: List[str] = []
    try:
        for p in base_search.rglob(pattern):
            if "node_modules" in p.parts or ".git" in p.parts or "__pycache__" in p.parts:
                continue
            matches.append(str(p))
            if len(matches) >= max_results:
                break
        return {"success": True, "count": len(matches), "matches": matches}
    except Exception as e:
        return {"success": False, "error": f"Search error: {e}"}
