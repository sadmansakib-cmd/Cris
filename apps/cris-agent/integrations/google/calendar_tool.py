"""
Cris Agent - Google Calendar Tool
Read and create Google Calendar events.
"""

from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional
from config import AppConfig
from core.config_loader import load_config
from integrations.google.auth import get_google_credentials

TOOL_NAME = "google_calendar"
TOOL_DESC = "Access Google Calendar: list upcoming events or create a new event."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["list", "create"],
            "description": "Calendar action."
        },
        "summary": {
            "type": "string",
            "description": "Event title/summary (required for 'create')."
        },
        "start_time": {
            "type": "string",
            "description": "Event start time in ISO format (e.g. '2026-11-25T14:00:00Z')."
        },
        "end_time": {
            "type": "string",
            "description": "Event end time in ISO format (e.g. '2026-11-25T15:00:00Z')."
        },
        "max_results": {
            "type": "integer",
            "description": "Maximum number of events to list (default 10)."
        }
    },
    "required": ["action"]
}
REQUIRES_CONFIRMATION = False


def execute(
    action: str,
    summary: str = "",
    start_time: str = "",
    end_time: str = "",
    max_results: int = 10,
    config: Optional[AppConfig] = None
) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    creds = get_google_credentials(config)
    if not creds:
        return {
            "success": False,
            "error": "Google Calendar not authenticated. Place credentials in tokens/google_credentials.json."
        }

    try:
        from googleapiclient.discovery import build
        service = build("calendar", "v3", credentials=creds)

        if action == "list":
            now = datetime.datetime.utcnow().isoformat() + "Z"
            events_result = service.events().list(
                calendarId="primary",
                timeMin=now,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime"
            ).execute()
            items = events_result.get("items", [])
            events = []
            for item in items:
                start = item.get("start", {}).get("dateTime", item.get("start", {}).get("date"))
                events.append({
                    "id": item.get("id"),
                    "summary": item.get("summary", "No title"),
                    "start": start,
                    "htmlLink": item.get("htmlLink")
                })
            return {"success": True, "count": len(events), "events": events}

        elif action == "create":
            if not summary or not start_time:
                return {"success": False, "error": "Summary and start_time are required to create an event."}

            end = end_time or start_time
            event_body = {
                "summary": summary,
                "start": {"dateTime": start_time},
                "end": {"dateTime": end}
            }
            created_event = service.events().insert(calendarId="primary", body=event_body).execute()
            return {
                "success": True,
                "event_id": created_event.get("id"),
                "summary": summary,
                "link": created_event.get("htmlLink"),
                "message": f"Successfully created event: '{summary}'"
            }

        return {"success": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"success": False, "error": f"Google Calendar error: {e}"}
