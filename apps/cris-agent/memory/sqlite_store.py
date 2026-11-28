"""
Cris Agent - SQLite Memory Store
Provides safe, persistent SQLite storage for facts, notes, reminders, tasks, and conversation logs.
"""

from __future__ import annotations

import json
import sqlite3
import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from contextlib import contextmanager


class SQLiteStore:
    def __init__(self, db_path: Path | str = ":memory:"):
        self._memory_conn = None
        if isinstance(db_path, str) and db_path != ":memory:":
            self.db_path = Path(db_path)
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
        else:
            self.db_path = db_path
            if self.db_path == ":memory:":
                self._memory_conn = sqlite3.connect(":memory:", check_same_thread=False)
                self._memory_conn.row_factory = sqlite3.Row
        self._init_schema()

    @contextmanager
    def _get_connection(self):
        if self._memory_conn is not None:
            try:
                yield self._memory_conn
                self._memory_conn.commit()
            except Exception:
                self._memory_conn.rollback()
                raise
        else:
            conn = sqlite3.connect(
                str(self.db_path),
                timeout=10.0,
                check_same_thread=False
            )
            conn.row_factory = sqlite3.Row
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

    def _init_schema(self) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Facts (user preferences, facts about user, etc.)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS facts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT NOT NULL DEFAULT 'general',
                    key TEXT NOT NULL UNIQUE,
                    value TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Notes
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tags TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Reminders
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS reminders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message TEXT NOT NULL,
                    due_at TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Tasks
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'todo',
                    priority TEXT NOT NULL DEFAULT 'medium',
                    due_date TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Conversation Log
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS conversation_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Autonomous Task Runner Queue (Part 3)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tasks_queue (
                    id TEXT PRIMARY KEY,
                    goal TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'queued',
                    steps_json TEXT NOT NULL DEFAULT '[]',
                    current_step INTEGER NOT NULL DEFAULT 0,
                    logs_json TEXT NOT NULL DEFAULT '[]',
                    error_message TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Quest Clock Rank Up (Gamified Tasks & Player Progress)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS quest_tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    intensity INTEGER NOT NULL DEFAULT 2,
                    xp INTEGER NOT NULL DEFAULT 50,
                    done INTEGER NOT NULL DEFAULT 0,
                    scheduled_at TEXT,
                    timer_minutes INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TEXT
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS player_progress (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    total_xp INTEGER NOT NULL DEFAULT 0,
                    rank_title TEXT NOT NULL DEFAULT 'E-Rank Novice',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cursor.execute("""
                INSERT OR IGNORE INTO player_progress (id, total_xp, rank_title)
                VALUES (1, 0, 'E-Rank Novice');
            """)
            # Hardening: On startup/restart, unfinished tasks MUST come back as 'paused', never auto-resumed
            cursor.execute("""
                UPDATE tasks_queue SET status = 'paused' 
                WHERE status IN ('running', 'queued');
            """)

    # ---------------- Facts ----------------
    def set_fact(self, key: str, value: str, category: str = "general") -> None:
        now = datetime.datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            conn.cursor().execute("""
                INSERT INTO facts (category, key, value, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value=excluded.value,
                    category=excluded.category,
                    updated_at=excluded.updated_at
            """, (category, key, value, now, now))

    def get_fact(self, key: str) -> Optional[str]:
        with self._get_connection() as conn:
            cur = conn.cursor().execute("SELECT value FROM facts WHERE key = ?", (key,))
            row = cur.fetchone()
            return row["value"] if row else None

    def list_facts(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            if category:
                cur.execute("SELECT * FROM facts WHERE category = ? ORDER BY key ASC", (category,))
            else:
                cur.execute("SELECT * FROM facts ORDER BY category, key ASC")
            return [dict(row) for row in cur.fetchall()]

    def delete_fact(self, key: str) -> bool:
        with self._get_connection() as conn:
            cur = conn.cursor().execute("DELETE FROM facts WHERE key = ?", (key,))
            return cur.rowcount > 0

    # ---------------- Notes ----------------
    def add_note(self, title: str, content: str, tags: str = "") -> int:
        with self._get_connection() as conn:
            cur = conn.cursor().execute(
                "INSERT INTO notes (title, content, tags) VALUES (?, ?, ?)",
                (title, content, tags)
            )
            return cur.lastrowid

    def search_notes(self, query: str = "") -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            if query:
                pattern = f"%{query}%"
                cur.execute(
                    "SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? OR tags LIKE ? ORDER BY updated_at DESC",
                    (pattern, pattern, pattern)
                )
            else:
                cur.execute("SELECT * FROM notes ORDER BY updated_at DESC")
            return [dict(row) for row in cur.fetchall()]

    def delete_note(self, note_id: int) -> bool:
        with self._get_connection() as conn:
            cur = conn.cursor().execute("DELETE FROM notes WHERE id = ?", (note_id,))
            return cur.rowcount > 0

    # ---------------- Reminders ----------------
    def add_reminder(self, message: str, due_at: str) -> int:
        with self._get_connection() as conn:
            cur = conn.cursor().execute(
                "INSERT INTO reminders (message, due_at, status) VALUES (?, ?, 'pending')",
                (message, due_at)
            )
            return cur.lastrowid

    def list_reminders(self, status: Optional[str] = "pending") -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            if status:
                cur.execute("SELECT * FROM reminders WHERE status = ? ORDER BY due_at ASC", (status,))
            else:
                cur.execute("SELECT * FROM reminders ORDER BY due_at ASC")
            return [dict(row) for row in cur.fetchall()]

    def update_reminder_status(self, reminder_id: int, status: str) -> bool:
        with self._get_connection() as conn:
            cur = conn.cursor().execute(
                "UPDATE reminders SET status = ? WHERE id = ?",
                (status, reminder_id)
            )
            return cur.rowcount > 0

    # ---------------- Tasks ----------------
    def add_task(self, title: str, description: str = "", priority: str = "medium", due_date: Optional[str] = None) -> int:
        with self._get_connection() as conn:
            cur = conn.cursor().execute(
                "INSERT INTO tasks (title, description, status, priority, due_date) VALUES (?, ?, 'todo', ?, ?)",
                (title, description, priority, due_date)
            )
            return cur.lastrowid

    def list_tasks(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            if status:
                cur.execute("SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC", (status,))
            else:
                cur.execute("SELECT * FROM tasks ORDER BY created_at DESC")
            return [dict(row) for row in cur.fetchall()]

    def update_task_status(self, task_id: int, status: str) -> bool:
        now = datetime.datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            cur = conn.cursor().execute(
                "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?",
                (status, now, task_id)
            )
            return cur.rowcount > 0

    def delete_task(self, task_id: int) -> bool:
        with self._get_connection() as conn:
            cur = conn.cursor().execute("DELETE FROM tasks WHERE id = ?", (task_id,))
            return cur.rowcount > 0

    # ---------------- Conversation Log ----------------
    def log_message(self, session_id: str, role: str, content: str) -> None:
        with self._get_connection() as conn:
            conn.cursor().execute(
                "INSERT INTO conversation_log (session_id, role, content) VALUES (?, ?, ?)",
                (session_id, role, content)
            )

    def get_conversation_history(self, session_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.cursor().execute(
                "SELECT role, content, timestamp FROM conversation_log WHERE session_id = ? ORDER BY id DESC LIMIT ?",
                (session_id, limit)
            )
            rows = cur.fetchall()
            return [dict(row) for row in reversed(rows)]

    # ---------------- Autonomous Task Runner Queue ----------------
    def create_queue_task(self, task_id: str, goal: str, steps: list) -> str:
        now = datetime.datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            conn.cursor().execute("""
                INSERT INTO tasks_queue (id, goal, status, steps_json, current_step, logs_json, created_at, updated_at)
                VALUES (?, ?, 'queued', ?, 0, '[]', ?, ?)
            """, (task_id, goal, json.dumps(steps), now, now))
            return task_id

    def get_queue_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.cursor().execute("SELECT * FROM tasks_queue WHERE id = ?", (task_id,))
            row = cur.fetchone()
            if not row:
                return None
            data = dict(row)
            data["steps"] = json.loads(data["steps_json"])
            data["logs"] = json.loads(data["logs_json"])
            return data

    def list_queue_tasks(self, limit: int = 30) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.cursor().execute("SELECT * FROM tasks_queue ORDER BY created_at DESC LIMIT ?", (limit,))
            rows = cur.fetchall()
            result = []
            for r in rows:
                item = dict(r)
                item["steps"] = json.loads(item["steps_json"])
                item["logs"] = json.loads(item["logs_json"])
                result.append(item)
            return result

    def update_queue_task(
        self,
        task_id: str,
        status: Optional[str] = None,
        current_step: Optional[int] = None,
        error_message: Optional[str] = None,
        steps: Optional[list] = None
    ) -> bool:
        now = datetime.datetime.utcnow().isoformat()
        fields = ["updated_at = ?"]
        params: list[Any] = [now]
        if status is not None:
            fields.append("status = ?")
            params.append(status)
        if current_step is not None:
            fields.append("current_step = ?")
            params.append(current_step)
        if error_message is not None:
            fields.append("error_message = ?")
            params.append(error_message)
        if steps is not None:
            fields.append("steps_json = ?")
            params.append(json.dumps(steps))
        params.append(task_id)
        sql = f"UPDATE tasks_queue SET {', '.join(fields)} WHERE id = ?"
        with self._get_connection() as conn:
            cur = conn.cursor().execute(sql, tuple(params))
            return cur.rowcount > 0

    def append_queue_log(self, task_id: str, log_message: str) -> bool:
        task = self.get_queue_task(task_id)
        if not task:
            return False
        logs = task["logs"]
        timestamp = datetime.datetime.utcnow().strftime("%H:%M:%S")
        logs.append(f"[{timestamp}] {log_message}")
        now = datetime.datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            cur = conn.cursor().execute(
                "UPDATE tasks_queue SET logs_json = ?, updated_at = ? WHERE id = ?",
                (json.dumps(logs), now, task_id)
            )
            return cur.rowcount > 0

    # ---------------- Quest Clock Rank Up (Gamified Tasks) ----------------
    def add_quest_task(
        self,
        task_id: str,
        title: str,
        intensity: int = 2,
        xp: int = 50,
        scheduled_at: Optional[str] = None,
        timer_minutes: Optional[int] = None
    ) -> Dict[str, Any]:
        now = datetime.datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            conn.cursor().execute("""
                INSERT INTO quest_tasks (id, title, intensity, xp, done, scheduled_at, timer_minutes, created_at)
                VALUES (?, ?, ?, ?, 0, ?, ?, ?)
            """, (task_id, title, intensity, xp, scheduled_at, timer_minutes, now))
        return {
            "id": task_id,
            "title": title,
            "intensity": intensity,
            "xp": xp,
            "done": False,
            "scheduled_at": scheduled_at,
            "timer_minutes": timer_minutes,
            "created_at": now
        }

    def complete_quest_task(self, identifier: str) -> Optional[Dict[str, Any]]:
        now = datetime.datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            cur = conn.cursor()
            # Match by exact id or case-insensitive title
            cur.execute("""
                SELECT * FROM quest_tasks 
                WHERE (id = ? OR LOWER(title) LIKE LOWER(?)) AND done = 0
                LIMIT 1
            """, (identifier, f"%{identifier}%"))
            row = cur.fetchone()
            if not row:
                return None
            task = dict(row)
            task_id = task["id"]
            xp_gained = task["xp"]

            # Mark task done
            cur.execute("""
                UPDATE quest_tasks SET done = 1, completed_at = ? WHERE id = ?
            """, (now, task_id))

            # Update Player Progress XP
            cur.execute("SELECT total_xp FROM player_progress WHERE id = 1")
            prog_row = cur.fetchone()
            current_xp = prog_row["total_xp"] if prog_row else 0
            new_xp = current_xp + xp_gained

            # Compute rank title
            if new_xp >= 2000:
                rank = "S-Rank Monarch"
            elif new_xp >= 1000:
                rank = "A-Rank Champion"
            elif new_xp >= 600:
                rank = "B-Rank Warrior"
            elif new_xp >= 300:
                rank = "C-Rank Adventurer"
            elif new_xp >= 100:
                rank = "D-Rank Apprentice"
            else:
                rank = "E-Rank Novice"

            cur.execute("""
                UPDATE player_progress 
                SET total_xp = ?, rank_title = ?, updated_at = ?
                WHERE id = 1
            """, (new_xp, rank, now))

            task["done"] = True
            task["completed_at"] = now
            task["xp_gained"] = xp_gained
            task["total_xp"] = new_xp
            task["rank_title"] = rank
            return task

    def list_quest_tasks(self, include_done: bool = True) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            if include_done:
                cur.execute("SELECT * FROM quest_tasks ORDER BY done ASC, created_at DESC")
            else:
                cur.execute("SELECT * FROM quest_tasks WHERE done = 0 ORDER BY created_at DESC")
            return [dict(r) for r in cur.fetchall()]

    def delete_quest_task(self, identifier: str) -> bool:
        with self._get_connection() as conn:
            cur = conn.cursor().execute("""
                DELETE FROM quest_tasks WHERE id = ? OR LOWER(title) LIKE LOWER(?)
            """, (identifier, f"%{identifier}%"))
            return cur.rowcount > 0

    def get_player_progress(self) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cur = conn.cursor().execute("SELECT total_xp, rank_title, updated_at FROM player_progress WHERE id = 1")
            row = cur.fetchone()
            if row:
                return dict(row)
            return {"total_xp": 0, "rank_title": "E-Rank Novice", "updated_at": datetime.datetime.utcnow().isoformat()}

