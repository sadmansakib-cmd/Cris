"""
Cris Agent - Daily Briefing Tool
Aggregates pending tasks, upcoming reminders, today's weather, and calendar events.
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from config import AppConfig
from core.config_loader import load_config
from memory.sqlite_store import SQLiteStore
from tools import weather

TOOL_NAME = "daily_briefing"
TOOL_DESC = "Generate a comprehensive daily briefing covering pending tasks, active reminders, and local weather."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "city": {
            "type": "string",
            "description": "City for weather forecast (default: user fact or 'Dhaka')."
        }
    }
}
REQUIRES_CONFIRMATION = False


def execute(city: str = "", config: Optional[AppConfig] = None) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    store = SQLiteStore(config.sqlite_db_path)

    # 1. Fetch pending tasks
    tasks = store.list_tasks(status="todo")

    # 2. Fetch pending reminders
    reminders = store.list_reminders(status="pending")

    # 3. Check city fact or default
    target_city = city or store.get_fact("home_city") or "Dhaka"
    weather_info = weather.execute(target_city)

    briefing_parts = [
        f"--- Daily Briefing ---",
        f"Weather ({target_city}): {weather_info.get('summary', 'Unavailable')}",
        f"Pending Tasks ({len(tasks)}):"
    ]

    for t in tasks[:5]:
        briefing_parts.append(f"  - [{t.get('priority', 'medium').upper()}] #{t['id']} {t['title']}")

    briefing_parts.append(f"Active Reminders ({len(reminders)}):")
    for r in reminders[:5]:
        briefing_parts.append(f"  - #{r['id']} {r['message']} (Due: {r['due_at']})")

    briefing_text = "\n".join(briefing_parts)

    return {
        "success": True,
        "city": target_city,
        "tasks_count": len(tasks),
        "reminders_count": len(reminders),
        "weather": weather_info,
        "briefing_text": briefing_text
    }
