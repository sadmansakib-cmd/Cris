"""
Tests for Tool Registry and Gated Execution.
"""

from core.confirmation_gate import ConfirmationGate
from tools.registry import ToolRegistry


def dummy_safe_action(x: int):
    return {"success": True, "result": x * 2}


def dummy_dangerous_action(target: str):
    return {"success": True, "deleted": target}


def test_registry_registration_and_execution():
    gate = ConfirmationGate(prompt_fn=lambda prompt: "yes")
    reg = ToolRegistry(gate)

    reg.register(
        name="double",
        desc="Doubles an integer",
        params={"type": "object", "properties": {"x": {"type": "integer"}}},
        execute_fn=dummy_safe_action,
        requires_confirmation=False
    )

    reg.register(
        name="destroy",
        desc="Destroys target",
        params={"type": "object", "properties": {"target": {"type": "string"}}},
        execute_fn=dummy_dangerous_action,
        requires_confirmation=True,
        confirmation_desc_fn=lambda args: f"Destroy {args.get('target')}"
    )

    # Execute safe tool
    res_safe = reg.execute("double", {"x": 5})
    assert res_safe["success"] is True
    assert res_safe["result"] == 10

    # Execute dangerous tool with approval
    res_dang = reg.execute("destroy", {"target": "cache"})
    assert res_dang["success"] is True
    assert res_dang["deleted"] == "cache"

    # Execute dangerous tool with rejection
    gate_reject = ConfirmationGate(prompt_fn=lambda prompt: "no")
    reg_reject = ToolRegistry(gate_reject)
    reg_reject.register(
        name="destroy",
        desc="Destroys target",
        params={"type": "object", "properties": {"target": {"type": "string"}}},
        execute_fn=dummy_dangerous_action,
        requires_confirmation=True,
        confirmation_desc_fn=lambda args: f"Destroy {args.get('target')}"
    )
    res_blocked = reg_reject.execute("destroy", {"target": "production"})
    assert res_blocked["success"] is False
    assert "denied" in res_blocked["error"].lower()
