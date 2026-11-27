"""
Code Hygiene & Security AST Test (Part 6).
Scans all source code in apps/cris-agent/ to ensure forbidden patterns are NEVER present:
- eval()
- exec()
- shell=True
- os.system()
"""

import ast
from pathlib import Path


class ForbiddenPatternVisitor(ast.NodeVisitor):
    def __init__(self, filename: str):
        self.filename = filename
        self.violations = []

    def visit_Call(self, node: ast.Call):
        # 1. Check for eval(...) and exec(...)
        if isinstance(node.func, ast.Name):
            if node.func.id in ("eval", "exec"):
                self.violations.append(f"{self.filename}:{node.lineno} - Forbidden call to '{node.func.id}()'")

        # 2. Check for os.system(...)
        elif isinstance(node.func, ast.Attribute):
            if node.func.attr == "system":
                if isinstance(node.func.value, ast.Name) and node.func.value.id == "os":
                    self.violations.append(f"{self.filename}:{node.lineno} - Forbidden call to 'os.system()'")

        # 3. Check for shell=True in keyword arguments
        for kw in node.keywords:
            if kw.arg == "shell":
                if isinstance(kw.value, ast.Constant) and kw.value.value is True:
                    self.violations.append(f"{self.filename}:{node.lineno} - Forbidden argument 'shell=True'")

        self.generic_visit(node)


def test_no_forbidden_patterns_in_codebase():
    """Verify eval, exec, shell=True, and os.system are completely absent from apps/cris-agent/."""
    agent_root = Path(__file__).parent.parent.resolve()
    py_files = list(agent_root.rglob("*.py"))
    
    assert len(py_files) > 10, f"Expected python files to scan, found: {len(py_files)}"

    all_violations = []

    for py_file in py_files:
        # Exclude this test file itself from self-flagging test logic
        if py_file.name == "test_code_hygiene.py":
            continue

        try:
            content = py_file.read_text(encoding="utf-8")
            tree = ast.parse(content, filename=str(py_file))
            visitor = ForbiddenPatternVisitor(str(py_file.relative_to(agent_root)))
            visitor.visit(tree)
            all_violations.extend(visitor.violations)
        except Exception as e:
            all_violations.append(f"Failed to parse {py_file}: {e}")

    assert len(all_violations) == 0, (
        f"SECURITY HYGIENE VIOLATIONS DETECTED ({len(all_violations)}):\n" +
        "\n".join(all_violations)
    )
