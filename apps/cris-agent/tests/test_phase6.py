"""
Tests for Phase 6: GitHub Integration, Deploy Helper, and App-Builder Workflow.
"""

import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

from config import AppConfig
from core.confirmation_gate import ConfirmationGate
from core.llm_provider import ResilientLLMClient, BaseProvider
from integrations.github import github_client
from workflows import deploy_helper, app_builder


class DummyLLM(BaseProvider):
    def generate(self, prompt: str, system_prompt: str = "") -> str:
        if "specification" in prompt.lower():
            return "App Spec: Habit tracker with dark mode and local persistence."
        elif "json object" in prompt.lower():
            return '{"index.html": "<!DOCTYPE html><html><body><h1>Habits</h1></body></html>", "style.css": "body { background: #000; }"}'
        return "Fixed code"


def test_github_confirmation_and_client():
    assert github_client.REQUIRES_CONFIRMATION is True
    desc = github_client.CONFIRMATION_DESCRIPTION_FN({
        "action": "commit_and_push",
        "commit_message": "feat: new feature"
    })
    assert "feat: new feature" in desc

    # Client without token reports clear error
    cfg = AppConfig(github_token="")
    client = github_client.GitHubClient(cfg)
    client.has_gh = False
    res = client.create_repo("test-repo")
    assert res["success"] is False
    assert "github_token" in res["error"].lower()


def test_deploy_helper_security():
    assert deploy_helper.REQUIRES_CONFIRMATION is True
    desc = deploy_helper.CONFIRMATION_DESCRIPTION_FN({
        "folder_path": "d:/halt/dist",
        "provider": "cloudflare"
    })
    assert "Cloudflare" in desc

    # Rejection of path outside allowed_roots
    cfg = AppConfig(allowed_roots=["d:/halt/apps/cris-agent/data"])
    res = deploy_helper.execute("C:/Windows/System32", provider="cloudflare", config=cfg)
    assert res["success"] is False
    assert "outside allowed directories" in res["error"].lower()


def test_app_builder_workflow_steps():
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_root = Path(tmp_dir).resolve()
        cfg = AppConfig(allowed_roots=[str(tmp_root)])
        gate_reject = ConfirmationGate(prompt_fn=lambda prompt: "no")

        dummy_llm_client = ResilientLLMClient(cfg)
        dummy_llm_client.providers["gemini"] = DummyLLM()

        logs = []
        wf = app_builder.AppBuilderWorkflow(
            config=cfg,
            llm=dummy_llm_client,
            confirmation_gate=gate_reject,
            step_logger=lambda msg: logs.append(msg)
        )

        res = wf.run(app_idea="A minimalist Pomodoro timer", project_name="test-timer")

        # Code was created under allowed roots
        assert (tmp_root / "test-timer" / "index.html").exists()

        # Step 4: user rejected deployment -> status is built_locally without false claims of deployment
        assert res["success"] is True
        assert res["status"] == "built_locally"
        assert "cancelled by user" in res["message"].lower()


def test_app_builder_honest_failure_reporting():
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_root = Path(tmp_dir).resolve()
        cfg = AppConfig(allowed_roots=[str(tmp_root)])

        class FailingLLM(BaseProvider):
            def generate(self, prompt: str, system_prompt: str = "") -> str:
                raise RuntimeError("API quota exhausted")

        failing_client = ResilientLLMClient(cfg)
        failing_client.providers["gemini"] = FailingLLM()

        wf = app_builder.AppBuilderWorkflow(config=cfg, llm=failing_client)
        res = wf.run(app_idea="Flawed App")

        # Reports exact failed step honestly
        assert res["success"] is False
        assert res["failed_step"] == 1
        assert "Spec" in res["step_name"]
        assert "API quota exhausted" in res["error"]
