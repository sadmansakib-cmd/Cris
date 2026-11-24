"""
Tests for Confirmation Gate.
"""

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
