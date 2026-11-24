"""
Tests for SQLite Memory Store.
"""

from memory.sqlite_store import SQLiteStore


def test_sqlite_memory_lifecycle():
    # In-memory database for testing
    store = SQLiteStore(":memory:")

    # 1. Facts
    store.set_fact("favorite_editor", "VS Code", "tools")
    assert store.get_fact("favorite_editor") == "VS Code"
    facts = store.list_facts("tools")
    assert len(facts) == 1
    assert facts[0]["key"] == "favorite_editor"
    assert store.delete_fact("favorite_editor") is True
    assert store.get_fact("favorite_editor") is None

    # 2. Notes
    note_id = store.add_note("Project Plan", "Build Cris voice assistant", "cris,python")
    assert note_id > 0
    results = store.search_notes("Cris")
    assert len(results) == 1
    assert results[0]["title"] == "Project Plan"
    assert store.delete_note(note_id) is True
    assert len(store.search_notes("Cris")) == 0

    # 3. Reminders
    rem_id = store.add_reminder("Water plants", "2026-11-25T10:00:00")
    pending = store.list_reminders("pending")
    assert len(pending) == 1
    assert pending[0]["message"] == "Water plants"
    store.update_reminder_status(rem_id, "completed")
    assert len(store.list_reminders("pending")) == 0

    # 4. Tasks
    task_id = store.add_task("Deploy app", "Deploy to cloudflare", "high")
    tasks = store.list_tasks("todo")
    assert len(tasks) == 1
    store.update_task_status(task_id, "done")
    assert len(store.list_tasks("todo")) == 0
    assert len(store.list_tasks("done")) == 1

    # 5. Conversation Log
    store.log_message("sess1", "user", "Hello Cris")
    store.log_message("sess1", "assistant", "Hello! How can I help?")
    history = store.get_conversation_history("sess1", limit=10)
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"
