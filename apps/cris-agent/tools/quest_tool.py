"""
Cris Agent - Quest Task Tool (Integrated with Quest Clock Rank Up)
Assigns, tracks, and completes gamified quest tasks with intensity levels, XP calculation,
and player rank up progression.
"""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from memory.sqlite_store import SQLiteStore

logger = logging.getLogger("cris.tools.quest")

TOOL_NAME = "quest_task"
TOOL_DESC = (
    "Manage gamified tasks in Quest Clock Rank Up: assign new quest task with level/intensity and date, "
    "mark tasks as completed (ticks checkmark and awards XP), list quests, or check rank progression."
)

TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["assign", "complete", "list", "progress", "delete"],
            "description": "Action to perform: 'assign' new task, 'complete' task, 'list' tasks, 'progress' to see rank, 'delete' task."
        },
        "title": {
            "type": "string",
            "description": "The title / name of the quest task (e.g. 'Morning workout', 'Fix login bug')."
        },
        "intensity": {
            "type": "integer",
            "description": "Task difficulty / level (1: Easy/25XP, 2: Medium/50XP, 3: Hard/100XP, 4: Extreme/200XP, 5: Legendary/400XP). Default is 2."
        },
        "scheduled_at": {
            "type": "string",
            "description": "Scheduled date or time (e.g. '2026-11-29 09:00', 'tomorrow 8am', or ISO string)."
        },
        "timer_minutes": {
            "type": "integer",
            "description": "Duration countdown timer in minutes (e.g. 15, 25, 45, 60)."
        },
        "task_id": {
            "type": "string",
            "description": "Optional specific task UUID when completing or deleting."
        }
    },
    "required": ["action"]
}

# XP calculation matching game.ts in quest-clock-rank-up
XP_MAP = {
    1: 25,
    2: 50,
    3: 100,
    4: 200,
    5: 400
}

LEVEL_NAMES = {
    1: "Level 1 (Easy)",
    2: "Level 2 (Normal)",
    3: "Level 3 (Hard)",
    4: "Level 4 (Extreme)",
    5: "Level 5 (Legendary)"
}


def _get_shared_cache_path() -> Path:
    base_dir = Path(__file__).parent.parent.resolve()
    cache_file = base_dir / "data" / "quest_tasks.json"
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    return cache_file


def _sync_shared_cache(store: SQLiteStore) -> None:
    try:
        tasks = store.list_quest_tasks()
        progress = store.get_player_progress()
        cache_data = {
            "player": progress,
            "tasks": tasks
        }
        cache_path = _get_shared_cache_path()
        cache_path.write_text(json.dumps(cache_data, indent=2), encoding="utf-8")
    except Exception as e:
        logger.debug("Shared quest cache sync error: %s", e)


def execute(
    action: str,
    title: str = "",
    intensity: int = 2,
    scheduled_at: Optional[str] = None,
    timer_minutes: Optional[int] = None,
    task_id: Optional[str] = None,
    store: Optional[SQLiteStore] = None,
    **kwargs
) -> Dict[str, Any]:
    """Execute quest task actions."""
    if store is None:
        db_path = Path(__file__).parent.parent / "data" / "cris_memory.db"
        store = SQLiteStore(db_path)

    action = action.lower().strip()

    # 1. ASSIGN NEW TASK
    if action in ("assign", "create", "new", "add"):
        if not title:
            return {"success": False, "error": "Task title is required to assign a quest."}

        # Normalize intensity
        level = max(1, min(5, int(intensity) if intensity else 2))
        xp = XP_MAP.get(level, 50)
        t_id = task_id or str(uuid.uuid4())

        task = store.add_quest_task(
            task_id=t_id,
            title=title.strip(),
            intensity=level,
            xp=xp,
            scheduled_at=scheduled_at,
            timer_minutes=timer_minutes
        )
        _sync_shared_cache(store)
        progress = store.get_player_progress()

        return {
            "success": True,
            "action": "assigned",
            "task": task,
            "level_name": LEVEL_NAMES.get(level),
            "xp_reward": xp,
            "player_rank": progress["rank_title"],
            "message": (
                f"Quest assigned: '{title.strip()}' at {LEVEL_NAMES.get(level)} (+{xp} XP). "
                f"Rank: {progress['rank_title']}."
            )
        }

    # 2. COMPLETE TASK
    elif action in ("complete", "done", "finish", "check"):
        identifier = task_id or title
        if not identifier:
            return {"success": False, "error": "Task title or task_id is required to complete a task."}

        completed_task = store.complete_quest_task(identifier.strip())
        if not completed_task:
            return {
                "success": False,
                "error": f"No active pending quest task found matching '{identifier}'."
            }

        _sync_shared_cache(store)

        return {
            "success": True,
            "action": "completed",
            "task": completed_task,
            "xp_gained": completed_task["xp_gained"],
            "total_xp": completed_task["total_xp"],
            "rank": completed_task["rank_title"],
            "message": (
                f"Quest '{completed_task['title']}' completed! (+{completed_task['xp_gained']} XP). "
                f"Current Rank: {completed_task['rank_title']} (Total XP: {completed_task['total_xp']})."
            )
        }

    # 3. LIST TASKS
    elif action in ("list", "all", "show"):
        tasks = store.list_quest_tasks()
        progress = store.get_player_progress()
        return {
            "success": True,
            "action": "list",
            "tasks": tasks,
            "count": len(tasks),
            "pending_count": len([t for t in tasks if not t.get("done")]),
            "player_progress": progress,
            "message": f"Found {len(tasks)} quests. Current Rank: {progress['rank_title']} ({progress['total_xp']} XP)."
        }

    # 4. PLAYER PROGRESS
    elif action in ("progress", "rank", "xp"):
        progress = store.get_player_progress()
        return {
            "success": True,
            "action": "progress",
            "player_progress": progress,
            "message": f"Player Rank: {progress['rank_title']} with {progress['total_xp']} total XP."
        }

    # 5. DELETE TASK
    elif action in ("delete", "remove"):
        identifier = task_id or title
        if not identifier:
            return {"success": False, "error": "Task title or task_id required to delete."}
        deleted = store.delete_quest_task(identifier.strip())
        _sync_shared_cache(store)
        return {
            "success": deleted,
            "action": "deleted",
            "message": f"Quest '{identifier}' was {'deleted' if deleted else 'not found'}."
        }

    return {"success": False, "error": f"Unknown action: '{action}'"}
