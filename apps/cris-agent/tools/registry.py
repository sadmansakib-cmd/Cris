"""
Cris Agent - Tool Registry
Dispatches tool execution, extracts function calling schemas, and enforces ConfirmationGate.
"""

from __future__ import annotations

import inspect
import logging
from typing import Any, Callable, Dict, List, Optional
from core.confirmation_gate import ConfirmationGate

logger = logging.getLogger("cris.tools")


class ToolDefinition:
    def __init__(
        self,
        name: str,
        desc: str,
        params: Dict[str, Any],
        execute_fn: Callable[..., Dict[str, Any]],
        requires_confirmation: bool = False,
        confirmation_desc_fn: Optional[Callable[[Dict[str, Any]], str]] = None
    ):
        self.name = name
        self.desc = desc
        self.params = params
        self.execute_fn = execute_fn
        self.requires_confirmation = requires_confirmation
        self.confirmation_desc_fn = confirmation_desc_fn

    def to_gemini_declaration(self) -> Dict[str, Any]:
        """Convert to Gemini FunctionDeclaration format."""
        return {
            "name": self.name,
            "description": self.desc,
            "parameters": self.params
        }


class ToolRegistry:
    def __init__(self, confirmation_gate: Optional[ConfirmationGate] = None):
        self.tools: Dict[str, ToolDefinition] = {}
        self.confirmation_gate = confirmation_gate or ConfirmationGate()

    def register(
        self,
        name: str,
        desc: str,
        params: Dict[str, Any],
        execute_fn: Callable[..., Dict[str, Any]],
        requires_confirmation: bool = False,
        confirmation_desc_fn: Optional[Callable[[Dict[str, Any]], str]] = None
    ) -> None:
        self.tools[name] = ToolDefinition(
            name=name,
            desc=desc,
            params=params,
            execute_fn=execute_fn,
            requires_confirmation=requires_confirmation,
            confirmation_desc_fn=confirmation_desc_fn
        )
        logger.debug(f"Registered tool: {name}")

    def register_module(self, module: Any) -> None:
        """Register a module adhering to TOOL_NAME, TOOL_DESC, TOOL_PARAMS, execute()."""
        name = getattr(module, "TOOL_NAME", None)
        desc = getattr(module, "TOOL_DESC", "")
        params = getattr(module, "TOOL_PARAMS", {"type": "object", "properties": {}})
        execute_fn = getattr(module, "execute", None)
        requires_conf = getattr(module, "REQUIRES_CONFIRMATION", False)
        conf_fn = getattr(module, "CONFIRMATION_DESCRIPTION_FN", None)

        if not name or not execute_fn:
            raise ValueError(f"Module {module} does not implement TOOL_NAME and execute().")

        self.register(
            name=name,
            desc=desc,
            params=params,
            execute_fn=execute_fn,
            requires_confirmation=requires_conf,
            confirmation_desc_fn=conf_fn
        )

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        return self.tools.get(name)

    def get_tools(self) -> List[str]:
        return list(self.tools.keys())

    def get_tool_description(self, name: str) -> str:
        tool = self.get_tool(name)
        return tool.desc if tool else ""

    def execute_tool(self, name: str, **kwargs) -> Dict[str, Any]:
        return self.execute(name, kwargs)

    def get_all_declarations(self) -> List[Dict[str, Any]]:
        return [tool.to_gemini_declaration() for tool in self.tools.values()]

    def execute(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        tool = self.get_tool(name)
        if not tool:
            return {"success": False, "error": f"Tool '{name}' not found in registry."}

        # Check confirmation gate if required
        if tool.requires_confirmation:
            if tool.confirmation_desc_fn:
                action_desc = tool.confirmation_desc_fn(args)
            else:
                action_desc = f"Execute dangerous action '{name}' with arguments {args}"

            approved = self.confirmation_gate.ask_confirmation(action_desc)
            if not approved:
                return {
                    "success": False,
                    "error": f"Action cancelled: Confirmation denied or timed out for '{name}'."
                }

        # Execute
        try:
            return tool.execute_fn(**args)
        except Exception as e:
            logger.error(f"Error executing tool '{name}': {e}", exc_info=True)
            return {"success": False, "error": str(e)}
