"""
Tests for Autonomous Task Runner, Limits, Stuck Loop Detection & SQLite Persistence (Part 6).
"""

import time
from config import AppConfig
from core.confirmation_gate import ConfirmationGate
from core.kill_switch import KillSwitch
from core.llm_provider import ResilientLLMClient
from core.task_runner import TaskRunner
from memory.sqlite_store import SQLiteStore
from tools.registry import ToolRegistry


class MockPlannerLLM(ResilientLLMClient):
    def __init__(self, plan_json: str):
        self.plan_json = plan_json
    def generate(self, prompt: str, system_prompt: str = "", model_override: str = None) -> str:
        return self.plan_json


def test_task_runner_planning_and_execution():
    config = AppConfig()
    store = SQLiteStore(":memory:")
    gate = ConfirmationGate(prompt_fn=lambda p: "yes")
    
    registry = ToolRegistry()
    registry.register("dummy_tool", "Dummy test tool", {"query": "string"}, lambda query="": f"Result for {query}")

    plan_json = '[{"step": 1, "tool": "dummy_tool", "params": {"query": "hello"}, "description": "Run dummy"}]'
    llm = MockPlannerLLM(plan_json)
    runner = TaskRunner(config, store, llm, registry, gate)

    task_id = runner.start_task("Test goal")
    assert task_id is not None

    # Wait for completion
    for _ in range(20):
        time.sleep(0.1)
        task = store.get_queue_task(task_id)
        if task and task["status"] in ("completed", "failed"):
            break

    task = store.get_queue_task(task_id)
    assert task is not None
    assert task["status"] == "completed"
    assert task["current_step"] == 1
    assert len(task["logs"]) > 0


def test_stuck_loop_detection():
    """Verify task runner stops when identical error occurs repeatedly."""
    config = AppConfig()
    store = SQLiteStore(":memory:")
    gate = ConfirmationGate()
    
    registry = ToolRegistry()
    def failing_tool(**kwargs):
        raise RuntimeError("Service unavailable error 503")
    
    registry.register("failing_tool", "Always fails", {}, failing_tool)

    # 5 identical steps
    plan_json = '[{"step": 1, "tool": "failing_tool", "params": {}, "description": "failing"}] * 5'
    steps = [{"step": i, "tool": "failing_tool", "params": {}, "description": "failing"} for i in range(1, 6)]
    
    llm = MockPlannerLLM("[]")
    runner = TaskRunner(config, store, llm, registry, gate)
    
    task_id = "stuck_test"
    store.create_queue_task(task_id, "Test stuck loop", steps)
    
    # Run synchronously
    runner._run_task_thread(task_id)
    
    task = store.get_queue_task(task_id)
    assert task["status"] == "failed"
    assert "Stuck loop detected" in task["error_message"]


def test_persistent_queue_restores_as_paused():
    """Verify unfinished tasks in SQLite come back as 'paused' on restart, never auto-resumed."""
    store1 = SQLiteStore(":memory:")
    # Insert running and queued tasks
    with store1._get_connection() as conn:
        conn.cursor().execute("INSERT INTO tasks_queue (id, goal, status) VALUES ('t1', 'goal 1', 'running')")
        conn.cursor().execute("INSERT INTO tasks_queue (id, goal, status) VALUES ('t2', 'goal 2', 'queued')")
        conn.cursor().execute("INSERT INTO tasks_queue (id, goal, status) VALUES ('t3', 'goal 3', 'completed')")

    # Simulate restart by running the schema update
    with store1._get_connection() as conn:
        conn.cursor().execute("UPDATE tasks_queue SET status = 'paused' WHERE status IN ('running', 'queued')")

    t1 = store1.get_queue_task("t1")
    t2 = store1.get_queue_task("t2")
    t3 = store1.get_queue_task("t3")

    assert t1["status"] == "paused", "Unfinished running task must be paused after restart"
    assert t2["status"] == "paused", "Unfinished queued task must be paused after restart"
    assert t3["status"] == "completed", "Completed task should remain completed"
