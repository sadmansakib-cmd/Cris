"""
Cris Agent - Confirmation Gate
Enforces explicit user confirmation before executing any dangerous or mutating action.
Fail-closed: times out after configured seconds (default 30) and rejects by default.
"""

from __future__ import annotations

import sys
import threading
import time
from typing import Callable, Optional


class ConfirmationDeniedError(Exception):
    """Raised when an action is denied by the user or times out."""
    pass


class ConfirmationGate:
    def __init__(
        self,
        timeout_seconds: int = 30,
        prompt_fn: Optional[Callable[[str], str]] = None,
        output_fn: Optional[Callable[[str], None]] = None
    ):
        self.timeout_seconds = timeout_seconds
        self._prompt_fn = prompt_fn
        self._output_fn = output_fn or print

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

    def ask_confirmation(self, action_sentence: str, timeout_seconds: Optional[int] = None) -> bool:
        """
        Ask user for explicit confirmation.
        Returns True ONLY if user explicitly says yes / হ্যাঁ.
        Fails closed (returns False) on any other response, error, or timeout.
        """
        timeout = timeout_seconds if timeout_seconds is not None else self.timeout_seconds
        prompt_text = f"Action: {action_sentence}"

        if self._prompt_fn:
            try:
                raw_answer = self._prompt_fn(action_sentence)
            except Exception:
                return False
        else:
            raw_answer = self._default_input_with_timeout(prompt_text, timeout)

        if not raw_answer:
            self._output_fn("[CONFIRMATION GATE] Timed out or no response. Action CANCELLED (fail-closed).")
            return False

        clean_answer = raw_answer.strip().lower()

        # Valid confirmation affirmatives (English and Bengali)
        affirmative = {"yes", "y", "confirm", "approve", "হ্যাঁ", "হাঁ", "হ্যা", "yes cris", "sure"}

        if clean_answer in affirmative:
            self._output_fn("[CONFIRMATION GATE] Action APPROVED by user.")
            return True
        else:
            self._output_fn(f"[CONFIRMATION GATE] Action REJECTED by user ('{clean_answer}').")
            return False
