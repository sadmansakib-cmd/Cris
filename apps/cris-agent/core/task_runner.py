"""
Cris Agent - Autonomous Task Runner (OpenClaw-style)
Plans multi-step user goals, persists execution state in SQLite, and executes steps
under strict limits and non-bypassable ConfirmationGate checks.
"""

from __future__ import annotations

import json
import logging
import re
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import AppConfig
from core.confirmation_gate import ConfirmationGate
from core.kill_switch import KillSwitch
from core.llm_provider import ResilientLLMClient
from memory.sqlite_store import SQLiteStore
from tools.registry import ToolRegistry

logger = logging.getLogger("cris.task_runner")


class TaskLimitExceededError(Exception):
    pass


class TaskRunner:
    MAX_STEPS = 30
    MAX_TOOL_CALLS = 50
    MAX_WALL_TIME_SECONDS = 600
    MAX_IDENTICAL_FAILURES = 3

    def __init__(
        self,
        config: AppConfig,
        store: SQLiteStore,
        llm: ResilientLLMClient,
        registry: ToolRegistry,
        gate: ConfirmationGate
    ):
        self.config = config
        self.store = store
        self.llm = llm
        self.registry = registry
        self.gate = gate
        self.kill_switch = KillSwitch.get_instance()
        self._active_threads: Dict[str, threading.Thread] = {}
        self._pause_events: Dict[str, threading.Event] = {}
        self._cancel_flags: Dict[str, bool] = {}
        self._lock = threading.Lock()

    # ---------------- Workflow Recipe Parsing (Zero Dependencies) ----------------
    def load_workflow_recipe(self, recipe_name: str) -> Optional[List[Dict[str, Any]]]:
        """Load pre-defined workflow recipe from workflows/recipes/<name>.yaml safely."""
        recipes_dir = self.config.base_dir / "workflows" / "recipes"
        target_file = None
        for ext in (".yaml", ".yml"):
            f = recipes_dir / f"{recipe_name}{ext}"
            if f.exists():
                target_file = f
                break
            
        if not target_file:
            return None

        steps = []
        try:
            content = target_file.read_text(encoding="utf-8")
            # Parse YAML subset
            current_step = {}
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.startswith("- step:") or line.startswith("step:"):
                    if current_step and "tool" in current_step:
                        steps.append(current_step)
                    current_step = {"step": len(steps) + 1, "params": {}}
                elif line.startswith("tool:"):
                    tool = line.split(":", 1)[1].strip().strip("'\"")
                    current_step["tool"] = tool
                elif line.startswith("description:"):
                    desc = line.split(":", 1)[1].strip().strip("'\"")
                    current_step["description"] = desc
                elif ":" in line and not line.startswith("steps:"):
                    k, v = line.split(":", 1)
                    k = k.strip().strip("- ")
                    v = v.strip().strip("'\"")
                    if k in ("name", "description") and "tool" not in current_step:
                        continue
                    if "params" in current_step:
                        current_step["params"][k] = v
            if current_step and "tool" in current_step:
                steps.append(current_step)
            return steps if steps else None
        except Exception as e:
            logger.error("Failed to parse workflow recipe %s: %s", recipe_name, e)
            return None

    # ---------------- Planning Phase ----------------
    def plan_goal(self, goal: str) -> List[Dict[str, Any]]:
        """
        Deconstruct a high-level goal into an ordered list of tool execution steps.
        Uses registered tools only.
        """
        # 1. Check if user referenced a workflow recipe
        recipe_match = re.search(r"run\s+(?:my\s+)?([a-zA-Z0-9_\-]+)\s*(?:workflow|recipe)?", goal, re.IGNORECASE)
        if recipe_match:
            recipe_name = recipe_match.group(1).lower().replace(" ", "_")
            steps = self.load_workflow_recipe(recipe_name)
            if steps:
                return steps

        # 2. Query planner LLM
        tools_summary = []
        for name in self.registry.get_tools():
            desc = self.registry.get_tool_description(name) or "No description"
            tools_summary.append(f"- {name}: {desc}")

        tools_str = "\n".join(tools_summary)
        system_prompt = (
            "You are Cris Planner. Break down the user's goal into an ordered sequence of actionable steps.\n"
            "CRITICAL: Use ONLY tools from this registered tool list:\n"
            f"{tools_str}\n\n"
            "Respond STRICTLY with a valid JSON array of objects. Do not include markdown codeblocks or other commentary.\n"
            "Each object must follow this structure:\n"
            "[\n"
            '  {"step": 1, "tool": "<exact_tool_name>", "params": {<parameters>}, "description": "<short description>"}\n'
            "]"
        )

        model_name = getattr(self.config, "model_planner", self.config.gemini_model)
        raw_plan = self.llm.generate(
            prompt=f"Goal: {goal}",
            system_prompt=system_prompt,
            model_override=model_name
        )

        # Parse JSON
        try:
            clean_json = raw_plan.strip()
            if clean_json.startswith("```"):
                clean_json = re.sub(r"^```(?:json)?\n?", "", clean_json)
                clean_json = re.sub(r"\n?```$", "", clean_json)
            parsed = json.loads(clean_json)
            if isinstance(parsed, list) and len(parsed) > 0:
                valid_steps = []
                for idx, s in enumerate(parsed):
                    tool_name = s.get("tool")
                    if tool_name in self.registry.get_tools():
                        valid_steps.append({
                            "step": idx + 1,
                            "tool": tool_name,
                            "params": s.get("params", {}),
                            "description": s.get("description", f"Execute {tool_name}")
                        })
                if valid_steps:
                    return valid_steps
        except Exception as e:
            logger.warning("Planner JSON parsing error: %s. Using single-tool fallback.", e)

        # Fallback single-step attempt
        return [{
            "step": 1,
            "tool": "web_search",
            "params": {"query": goal},
            "description": f"Search web for {goal}"
        }]

    # ---------------- Task Execution Lifecycle ----------------
    def start_task(self, goal: str) -> str:
        """Create and queue a new autonomous task."""
        task_id = str(uuid.uuid4())[:8]
        steps = self.plan_goal(goal)
        self.store.create_queue_task(task_id, goal, steps)

        pause_event = threading.Event()
        pause_event.set()  # Unpaused initially

        with self._lock:
            self._pause_events[task_id] = pause_event
            self._cancel_flags[task_id] = False

        thread = threading.Thread(
            target=self._run_task_thread,
            args=(task_id,),
            daemon=True
        )
        with self._lock:
            self._active_threads[task_id] = thread
        thread.start()
        return task_id

    def _run_task_thread(self, task_id: str) -> None:
        """Background executor loop for the task."""
        start_time = time.time()
        tool_calls_count = 0
        last_failure_reason = None
        consecutive_identical_failures = 0

        self.store.update_queue_task(task_id, status="running")
        self.store.append_queue_log(task_id, f"Started autonomous execution for task {task_id}")

        task_data = self.store.get_queue_task(task_id)
        if not task_data:
            return

        steps = task_data.get("steps", [])
        current_step_idx = task_data.get("current_step", 0)

        try:
            while current_step_idx < len(steps):
                # 1. Check Kill Switch
                if self.kill_switch.is_triggered():
                    self.store.update_queue_task(task_id, status="failed", error_message="Aborted by Emergency Kill Switch")
                    self.store.append_queue_log(task_id, "[EMERGENCY] Stopped instantly by Kill Switch (Ctrl+Alt+Q)")
                    return

                # 2. Check Cancellation
                with self._lock:
                    if self._cancel_flags.get(task_id, False):
                        self.store.update_queue_task(task_id, status="failed", error_message="Cancelled by user")
                        self.store.append_queue_log(task_id, "Task was cancelled by user")
                        return

                # 3. Check Pause
                pause_event = self._pause_events.get(task_id)
                if pause_event and not pause_event.is_set():
                    self.store.update_queue_task(task_id, status="paused")
                    self.store.append_queue_log(task_id, "Task paused. Waiting to resume...")
                    pause_event.wait()
                    self.store.update_queue_task(task_id, status="running")
                    self.store.append_queue_log(task_id, "Task resumed")

                # 4. Check Limits
                if current_step_idx >= self.MAX_STEPS:
                    raise TaskLimitExceededError(f"Exceeded max step limit of {self.MAX_STEPS}")

                if tool_calls_count >= self.MAX_TOOL_CALLS:
                    raise TaskLimitExceededError(f"Exceeded max tool call limit of {self.MAX_TOOL_CALLS}")

                if time.time() - start_time > self.MAX_WALL_TIME_SECONDS:
                    raise TaskLimitExceededError(f"Exceeded max wall clock time of {self.MAX_WALL_TIME_SECONDS}s")

                # Execute Step
                step = steps[current_step_idx]
                step_num = step.get("step", current_step_idx + 1)
                tool_name = step.get("tool")
                params = step.get("params", {})
                desc = step.get("description", tool_name)

                self.store.append_queue_log(task_id, f"Step {step_num}/{len(steps)}: {desc} ({tool_name})")

                # Note: any irreversible tool will call gate.ask_confirmation() internally.
                # Planner cannot bypass or pre-approve it!
                try:
                    tool_calls_count += 1
                    output = self.registry.execute_tool(tool_name, **params)
                    if isinstance(output, dict) and output.get("success") is False:
                        raise RuntimeError(output.get("error", "Tool execution failed"))
                    self.store.append_queue_log(task_id, f"Step {step_num} result: {str(output)[:200]}")
                    consecutive_identical_failures = 0
                except Exception as step_err:
                    err_msg = str(step_err)
                    self.store.append_queue_log(task_id, f"Step {step_num} failed: {err_msg}")
                    
                    # Stuck loop detection
                    if err_msg == last_failure_reason:
                        consecutive_identical_failures += 1
                        if consecutive_identical_failures >= self.MAX_IDENTICAL_FAILURES:
                            self.store.update_queue_task(
                                task_id,
                                status="failed",
                                current_step=current_step_idx,
                                error_message=f"Stuck loop detected: {err_msg}"
                            )
                            self.store.append_queue_log(task_id, f"Aborting: Repeated failure {consecutive_identical_failures} times on identical error.")
                            return
                    else:
                        consecutive_identical_failures = 1
                        last_failure_reason = err_msg

                current_step_idx += 1
                self.store.update_queue_task(task_id, current_step=current_step_idx)

            # Successfully completed all steps
            self.store.update_queue_task(task_id, status="completed")
            self.store.append_queue_log(task_id, f"Task completed successfully in {round(time.time() - start_time, 1)}s")

        except Exception as e:
            self.store.update_queue_task(task_id, status="failed", error_message=str(e))
            self.store.append_queue_log(task_id, f"Task error: {e}")
        finally:
            with self._lock:
                self._active_threads.pop(task_id, None)

    # ---------------- Task Controls ----------------
    def pause_task(self, task_id: str) -> bool:
        """Pause a running task."""
        with self._lock:
            pe = self._pause_events.get(task_id)
            if pe:
                pe.clear()
                self.store.update_queue_task(task_id, status="paused")
                return True
        return False

    def resume_task(self, task_id: str) -> bool:
        """Resume a paused task."""
        with self._lock:
            pe = self._pause_events.get(task_id)
            if pe:
                pe.set()
                self.store.update_queue_task(task_id, status="running")
                return True
            else:
                # Task might have been paused from previous restart
                task = self.store.get_queue_task(task_id)
                if task and task.get("status") == "paused":
                    pe = threading.Event()
                    pe.set()
                    self._pause_events[task_id] = pe
                    self._cancel_flags[task_id] = False
                    thread = threading.Thread(
                        target=self._run_task_thread,
                        args=(task_id,),
                        daemon=True
                    )
                    self._active_threads[task_id] = thread
                    thread.start()
                    return True
        return False

    def cancel_task(self, task_id: str) -> bool:
        """Cancel an active or queued task."""
        with self._lock:
            self._cancel_flags[task_id] = True
            pe = self._pause_events.get(task_id)
            if pe:
                pe.set()  # Unblock if waiting
            self.store.update_queue_task(task_id, status="failed", error_message="Cancelled by user")
            self.store.append_queue_log(task_id, "Task was cancelled")
            return True
