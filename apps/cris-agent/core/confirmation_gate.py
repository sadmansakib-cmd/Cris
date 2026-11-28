"""
Cris Agent - Confirmation Gate
Enforces explicit user confirmation before executing any dangerous or mutating action.
Fail-closed: times out after configured seconds (default 30) and rejects by default.
Secured against approval injection: approvals accepted ONLY from authenticated UI, voice, or CLI.
"""

from __future__ import annotations

import sys
import threading
import time
import uuid
from typing import Callable, Dict, List, Optional


class ConfirmationDeniedError(Exception):
    """Raised when an action is denied by the user or times out."""
    pass


class ApprovalRequest:
    def __init__(self, request_id: str, action_sentence: str, screenshot_path: Optional[str] = None):
        self.id = request_id
        self.action = action_sentence
        self.screenshot_path = screenshot_path
        self.status = "pending"  # pending, approved, rejected, timed_out
        self.created_at = time.time()
        self.source = None
        self._event = threading.Event()
        self.result = False


class ConfirmationGate:
    _instance: Optional["ConfirmationGate"] = None
    _lock = threading.Lock()

    def __init__(
        self,
        timeout_seconds: int = 30,
        prompt_fn: Optional[Callable[[str], str]] = None,
        output_fn: Optional[Callable[[str], None]] = None
    ):
        self.timeout_seconds = timeout_seconds
        self._prompt_fn = prompt_fn
        self._output_fn = output_fn or print
        self._pending_requests: Dict[str, ApprovalRequest] = {}
        self._pending_lock = threading.Lock()
        ConfirmationGate._instance = self

    @classmethod
    def get_instance(cls) -> "ConfirmationGate":
        with cls._lock:
            if cls._instance is None:
                cls._instance = ConfirmationGate()
            return cls._instance

    def _default_input_with_timeout(self, prompt_text: str, timeout: int) -> Optional[str]:
        """Read standard input with a timeout in a background thread."""
        self._output_fn(f"\n[CONFIRMATION GATE] {prompt_text} (Timeout: {timeout}s)")
        self._output_fn("Reply 'yes' / 'হ্যাঁ' to confirm, or 'no' to abort: ")

        user_response = [None]

        def get_input():
            try:
                user_response[0] = sys.stdin.readline()
            except Exception:
                pass

        t = threading.Thread(target=get_input, daemon=True)
        t.start()
        t.join(timeout=timeout)

        if t.is_alive():
            return None  # Timed out

        val = user_response[0]
        return val.strip() if val else None

    def ask_confirmation(
        self,
        action_sentence: str,
        timeout_seconds: Optional[int] = None,
        screenshot_path: Optional[str] = None,
        source: str = "cli_or_ui"
    ) -> bool:
        """
        Ask user for explicit confirmation.
        Creates a pending ApprovalRequest so the authenticated UI or CLI can respond.
        Returns True ONLY if user explicitly approves.
        Fails closed (returns False) on timeout or rejection.
        """
        timeout = timeout_seconds if timeout_seconds is not None else self.timeout_seconds
        prompt_text = f"Action: {action_sentence}"
        req_id = str(uuid.uuid4())[:8]

        req = ApprovalRequest(req_id, action_sentence, screenshot_path)
        with self._pending_lock:
            self._pending_requests[req_id] = req

        # If custom prompt function is supplied (e.g. for testing)
        if self._prompt_fn:
            try:
                raw_answer = self._prompt_fn(action_sentence)
            except Exception:
                req.status = "rejected"
                return False
            result = self._evaluate_response(raw_answer, source="test")
            req.status = "approved" if result else "rejected"
            with self._pending_lock:
                self._pending_requests.pop(req_id, None)
            return result

        # Start CLI input in a background helper while also allowing the UI to resolve it
        def cli_waiter():
            raw = self._default_input_with_timeout(prompt_text, timeout)
            if raw and req.status == "pending":
                if self._evaluate_response(raw, source="user_cli"):
                    self.resolve_request(req_id, approve=True, source="user_cli")
                else:
                    self.resolve_request(req_id, approve=False, source="user_cli")

        cli_thread = threading.Thread(target=cli_waiter, daemon=True)
        cli_thread.start()

        # Wait on the event or timeout
        signaled = req._event.wait(timeout=timeout)
        with self._pending_lock:
            self._pending_requests.pop(req_id, None)

        if not signaled or req.status == "pending":
            req.status = "timed_out"
            self._output_fn("[CONFIRMATION GATE] Timed out or no response. Action CANCELLED (fail-closed).")
            return False

        if req.status == "approved" and req.result:
            self._output_fn(f"[CONFIRMATION GATE] Action APPROVED by user (via {req.source}).")
            return True
        else:
            self._output_fn(f"[CONFIRMATION GATE] Action REJECTED by user (via {req.source}).")
            return False

    def create_pending_request(self, action_sentence: str, screenshot_path: Optional[str] = None) -> str:
        """Create and register an unblocking pending approval request for UI display."""
        req_id = str(uuid.uuid4())[:8]
        req = ApprovalRequest(req_id, action_sentence, screenshot_path)
        with self._pending_lock:
            self._pending_requests[req_id] = req
        return req_id

    def list_pending_requests(self) -> List[Dict]:
        """Return list of active pending approvals for the UI."""
        with self._pending_lock:
            return [
                {
                    "id": r.id,
                    "action": r.action,
                    "screenshot_path": r.screenshot_path,
                    "created_at": r.created_at,
                    "status": r.status
                }
                for r in self._pending_requests.values()
                if r.status == "pending"
            ]

    def resolve_request(self, req_id: str, approve: bool, source: str = "authenticated_ui") -> bool:
        """
        Resolve a pending approval request.
        SECURITY: Rejects any resolution from untrusted sources (e.g. tool output, web content).
        Allowed sources: 'authenticated_ui', 'user_cli', 'user_voice'.
        """
        valid_sources = {"authenticated_ui", "user_cli", "user_voice"}
        if source not in valid_sources:
            self._output_fn(f"[CONFIRMATION GATE] REJECTED untrusted approval source: '{source}'")
            return False

        with self._pending_lock:
            req = self._pending_requests.get(req_id)
            if not req or req.status != "pending":
                return False

            req.source = source
            req.result = bool(approve)
            req.status = "approved" if approve else "rejected"
            req._event.set()
            return True

    def _evaluate_response(self, raw_answer: str, source: str = "user_cli") -> bool:
        """Evaluate affirmative confirmation text."""
        if not raw_answer:
            return False
        clean = raw_answer.strip().lower()
        affirmative = {"yes", "y", "confirm", "approve", "হ্যাঁ", "হাঁ", "হ্যা", "yes cris", "sure"}
        return clean in affirmative
