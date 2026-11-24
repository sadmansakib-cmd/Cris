"""
Cris Agent - Google Drive Tool
Search and download Google Drive files.
Downloads are strictly restricted to folders within allowed_roots.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any, Dict, List, Optional
from config import AppConfig
from core.config_loader import load_config
from integrations.google.auth import get_google_credentials

TOOL_NAME = "google_drive"
TOOL_DESC = "Search and download files from Google Drive into allowed local folders."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["search", "download"],
            "description": "Drive operation."
        },
        "query": {
            "type": "string",
            "description": "File search name or query."
        },
        "file_id": {
            "type": "string",
            "description": "Google Drive file ID (required for 'download')."
        },
        "dest_path": {
            "type": "string",
            "description": "Local destination path (must be inside allowed_roots)."
        },
        "max_results": {
            "type": "integer",
            "description": "Maximum number of search results (default 10)."
        }
    },
    "required": ["action"]
}
REQUIRES_CONFIRMATION = False


def execute(
    action: str,
    query: str = "",
    file_id: str = "",
    dest_path: str = "",
    max_results: int = 10,
    config: Optional[AppConfig] = None
) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    if action == "download":
        if not file_id or not dest_path:
            return {"success": False, "error": "file_id and dest_path are required to download."}

        dest = Path(dest_path).resolve()
        if not config.is_path_allowed(dest):
            return {
                "success": False,
                "error": f"Access Denied: Destination '{dest}' is outside allowed directories."
            }

    creds = get_google_credentials(config)
    if not creds:
        return {
            "success": False,
            "error": "Google Drive not authenticated. Place credentials in tokens/google_credentials.json."
        }

    try:
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaIoBaseDownload
        service = build("drive", "v3", credentials=creds)

        if action == "search":
            q = f"name contains '{query}' and trashed = false" if query else "trashed = false"
            results = service.files().list(
                q=q,
                pageSize=max_results,
                fields="files(id, name, mimeType, size, modifiedTime)"
            ).execute()
            files = results.get("files", [])
            return {"success": True, "count": len(files), "files": files}

        elif action == "download":
            dest = Path(dest_path).resolve()
            dest.parent.mkdir(parents=True, exist_ok=True)
            request = service.files().get_media(fileId=file_id)
            with open(dest, "wb") as f:
                downloader = MediaIoBaseDownload(f, request)
                done = False
                while not done:
                    status, done = downloader.next_chunk()

            return {
                "success": True,
                "file_id": file_id,
                "dest_path": str(dest),
                "message": f"Downloaded Google Drive file to {dest.name}"
            }

        return {"success": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"success": False, "error": f"Google Drive error: {e}"}
