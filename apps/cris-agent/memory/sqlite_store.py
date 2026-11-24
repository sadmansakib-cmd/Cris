"""
Cris Agent - SQLite Memory Store
Provides safe, persistent SQLite storage for facts, notes, reminders, tasks, and conversation logs.
"""

from __future__ import annotations

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
