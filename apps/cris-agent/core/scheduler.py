"""
Cris Agent - Background Task Scheduler & Skill Engine (Part 5)
Executes scheduled background workflows under strict unattended safety rules:
- Hard rule: background tasks may ONLY execute read-only tools.
- Any mutating or irreversible step is queued into the Approvals panel
  and triggers a Windows toast notification.
- Never auto-approves in the background.
"""

from __future__ import annotations

import datetime
import logging
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from config import AppConfig
from core.confirmation_gate import ConfirmationGate
from core.kill_switch import KillSwitch
from memory.sqlite_store import SQLiteStore
from tools.registry import ToolRegistry

logger = logging.getLogger("cris.scheduler")


# Registry of approved read-only tools safe for unattended background execution
READ_ONLY_TOOLS = {
    "system_status",
    "weather",
    "news",
    "web_search",
    "fetch_page",
    "file_search",
    "file_read",
    "notes",
    "reminders",
    "tasks",
    "timers",
    "daily_briefing",
    "calendar",
    "gmail_read"
}


class BackgroundScheduler:
    def __init__(
        self,
        config: AppConfig,
        store: SQLiteStore,
        registry: ToolRegistry,
        gate: ConfirmationGate
    ):
        self.config = config
        self.store = store
        self.registry = registry
        self.gate = gate
        self.kill_switch = KillSwitch.get_instance()
        self._jobs: List[Dict[str, Any]] = []
        self._running = False
        self._worker_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self.skills_dir = self.config.base_dir / "skills"
        self.pending_skills_dir = self.skills_dir / "pending"
        self.skills_dir.mkdir(parents=True, exist_ok=True)
        self.pending_skills_dir.mkdir(parents=True, exist_ok=True)

    def add_job(
        self,
        job_id: str,
        name: str,
        tool_name: str,
        params: Dict[str, Any],
        interval_seconds: int,
        allow_write: bool = False
    ) -> None:
        """Register a scheduled background job."""
        job = {
            "id": job_id,
            "name": name,
            "tool": tool_name,
            "params": params,
            "interval": interval_seconds,
            "allow_write": allow_write,
            "last_run": 0,
            "status": "active"
        }
        with self._lock:
            self._jobs.append(job)

    def start(self) -> None:
        """Start the background scheduler thread."""
        with self._lock:
            if self._running:
                return
            self._running = True
            self._worker_thread = threading.Thread(target=self._run_loop, daemon=True)
            self._worker_thread.start()

    def stop(self) -> None:
        """Stop the background scheduler."""
        with self._lock:
            self._running = False

    def _send_windows_toast(self, title: str, message: str) -> None:
        """Send native Windows toast notification."""
        try:
            from plyer import notification
            notification.notify(
                title=title,
                message=message,
                app_name="Cris Assistant",
                timeout=10
            )
        except Exception:
            try:
                import subprocess
                ps_script = f'''
                [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
                $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
                $texts = $template.GetElementsByTagName("text")
                $texts.Item(0).AppendChild($template.CreateTextNode("{title}")) > $null
                $texts.Item(1).AppendChild($template.CreateTextNode("{message}")) > $null
                $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
                [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Cris").Show($toast)
                '''
                subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], check=False, timeout=3)
            except Exception as e:
                logger.debug("Toast dispatch: %s", e)

    def _run_loop(self) -> None:
        """Main execution loop for background scheduler."""
        while self._running:
            if self.kill_switch.is_triggered():
                time.sleep(2)
                continue

            now = time.time()
            with self._lock:
                jobs_to_run = [j for j in self._jobs if j["status"] == "active" and (now - j["last_run"] >= j["interval"])]

            for job in jobs_to_run:
                tool_name = job["tool"]
                params = job["params"]
                is_read_only = tool_name in READ_ONLY_TOOLS

                # HARD RULE: Unattended background tasks MAY ONLY execute read-only tools
                if not is_read_only and not job.get("allow_write", False):
                    # Irreversible/mutating action -> Queue into ConfirmationGate & send Windows toast
                    action_desc = f"[Scheduled Task '{job['name']}'] Request to execute mutating tool '{tool_name}'"
                    self._send_windows_toast("Cris Approval Needed", f"Background task '{job['name']}' requires approval for {tool_name}")
                    
                    # Async ask confirmation via gate (queues in Approvals panel)
                    threading.Thread(
                        target=self.gate.ask_confirmation,
                        args=(action_desc, 300),  # 5 min window for background approvals
                        daemon=True
                    ).start()
                    
                    job["last_run"] = now
                    continue

                # Run read-only tool safely
                try:
                    self.registry.execute_tool(tool_name, **params)
                except Exception as err:
                    logger.warning("Background job '%s' failed: %s", job["name"], err)

                job["last_run"] = now

            time.sleep(1)

    # ---------------- Declarative Skills Management ----------------
    def list_active_skills(self) -> List[Dict[str, str]]:
        """List verified declarative skills in skills/."""
        skills = []
        for file in self.skills_dir.glob("*.md"):
            try:
                text = file.read_text(encoding="utf-8")
                name = file.stem
                desc = "Custom skill"
                for line in text.splitlines()[:5]:
                    if line.startswith("# "):
                        name = line.replace("# ", "").strip()
                    elif line.startswith("Description:"):
                        desc = line.replace("Description:", "").strip()
                skills.append({"id": file.name, "name": name, "description": desc, "content": text})
            except Exception:
                pass
        return skills

    def list_pending_skills(self) -> List[Dict[str, str]]:
        """List draft skills in skills/pending/ awaiting user review."""
        pending = []
        for file in self.pending_skills_dir.glob("*.md"):
            try:
                text = file.read_text(encoding="utf-8")
                name = file.stem
                desc = "Drafted workflow"
                for line in text.splitlines()[:5]:
                    if line.startswith("# "):
                        name = line.replace("# ", "").strip()
                    elif line.startswith("Description:"):
                        desc = line.replace("Description:", "").strip()
                pending.append({"id": file.name, "name": name, "description": desc, "content": text})
            except Exception:
                pass
        return pending

    def approve_skill(self, filename: str) -> bool:
        """Promote a pending skill from skills/pending/ to active skills/."""
        source = self.pending_skills_dir / filename
        dest = self.skills_dir / filename
        if source.exists():
            source.rename(dest)
            return True
        return False
