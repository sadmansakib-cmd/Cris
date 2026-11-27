"""
Tests for Background Scheduler & Declarative Skills (Part 6).
"""

from pathlib import Path
from config import AppConfig
from core.confirmation_gate import ConfirmationGate
from core.scheduler import BackgroundScheduler, READ_ONLY_TOOLS
from memory.sqlite_store import SQLiteStore
from tools.registry import ToolRegistry


def test_scheduler_read_only_rule_enforcement():
    """Verify background scheduler allows read-only tools and blocks mutating tools unattended."""
    config = AppConfig()
    store = SQLiteStore(":memory:")
    gate = ConfirmationGate(timeout_seconds=1)
    registry = ToolRegistry()

    read_executed = []
    write_executed = []

    registry.register("weather", "Read weather", {}, lambda **kw: read_executed.append(True))
    registry.register("file_delete", "Delete file", {"path": "string"}, lambda **kw: write_executed.append(True))

    scheduler = BackgroundScheduler(config, store, registry, gate)

    # 1. Read-only job
    scheduler.add_job("j1", "Check Weather", "weather", {}, interval_seconds=1, allow_write=False)
    # 2. Mutating job without pre-approval
    scheduler.add_job("j2", "Delete Temp Files", "file_delete", {"path": "test.txt"}, interval_seconds=1, allow_write=False)

    # Run one evaluation pass
    jobs_to_run = scheduler._jobs
    for job in jobs_to_run:
        tool_name = job["tool"]
        is_read_only = tool_name in READ_ONLY_TOOLS
        if not is_read_only and not job.get("allow_write", False):
            # Mutating -> Queued to gate, NOT executed directly
            continue
        registry.execute_tool(tool_name, **job["params"])

    assert len(read_executed) == 1, "Read-only tool must execute"
    assert len(write_executed) == 0, "Mutating tool must NOT execute unattended in background"


def test_declarative_skills_review_and_approval():
    """Verify declarative skills lifecycle: draft in pending -> approval moves to active."""
    import tempfile
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        config = AppConfig()
        config.base_dir = tmp_path
        store = SQLiteStore(":memory:")
        gate = ConfirmationGate()
        registry = ToolRegistry()

        scheduler = BackgroundScheduler(config, store, registry, gate)

        # Create a draft skill in pending
        draft_file = scheduler.pending_skills_dir / "clean_cache.md"
        draft_file.write_text("# Clean Cache\nDescription: Purges cached files.\nSteps:\n1. run system_status", encoding="utf-8")

        pending = scheduler.list_pending_skills()
        assert len(pending) == 1
        assert pending[0]["name"] == "Clean Cache"

        # User approves skill in Skills Panel
        approved = scheduler.approve_skill("clean_cache.md")
        assert approved is True

        # Now pending should be empty and active should have it
        assert len(scheduler.list_pending_skills()) == 0
        active = scheduler.list_active_skills()
        assert len(active) == 1
        assert active[0]["name"] == "Clean Cache"
