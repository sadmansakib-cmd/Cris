"""
Tests for Confirmation Gate.
"""

import threading
import time
from core.confirmation_gate import ConfirmationGate


def test_confirmation_gate_approval():
    # User confirms in English
    gate_yes = ConfirmationGate(prompt_fn=lambda prompt: "yes")
    assert gate_yes.ask_confirmation("Delete file") is True

    # User confirms with single letter
    gate_y = ConfirmationGate(prompt_fn=lambda prompt: "y")
    assert gate_y.ask_confirmation("Deploy project") is True

    # User confirms in Bengali
    gate_bn = ConfirmationGate(prompt_fn=lambda prompt: "হ্যাঁ")
    assert gate_bn.ask_confirmation("মুছে ফেলুন") is True


def test_confirmation_gate_rejection():
    # User rejects explicitly
    gate_no = ConfirmationGate(prompt_fn=lambda prompt: "no")
    assert gate_no.ask_confirmation("Delete file") is False

    # User gives ambiguous or refusal response
    gate_other = ConfirmationGate(prompt_fn=lambda prompt: "wait, what?")
    assert gate_other.ask_confirmation("Send email") is False


def test_confirmation_gate_timeout():
    # Simulated timeout (returns None)
    gate_timeout = ConfirmationGate(prompt_fn=lambda prompt: None)
    assert gate_timeout.ask_confirmation("Format disk") is False


def test_confirmation_gate_pending_and_sources():
    gate = ConfirmationGate(timeout_seconds=2)
    
    # Test untrusted source rejection
    assert gate.resolve_request("fake_id", approve=True, source="page_content") is False
    assert gate.resolve_request("fake_id", approve=True, source="email_body") is False
    assert gate.resolve_request("fake_id", approve=True, source="tool_output") is False
    
    # Test async UI resolution
    result_box = []
    
    def async_ask():
        res = gate.ask_confirmation("Deploy to production", timeout_seconds=2)
        result_box.append(res)
        
    t = threading.Thread(target=async_ask)
    t.start()
    
    # Wait for pending request to appear
    time.sleep(0.1)
    pending = gate.list_pending_requests()
    assert len(pending) == 1
    req_id = pending[0]["id"]
    assert pending[0]["action"] == "Deploy to production"
    
    # Resolve via authenticated UI
    resolved = gate.resolve_request(req_id, approve=True, source="authenticated_ui")
    assert resolved is True
    
    t.join(timeout=2)
    assert len(result_box) == 1
    assert result_box[0] is True
