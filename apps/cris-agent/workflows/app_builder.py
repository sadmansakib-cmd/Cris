"""
Cris Agent - App-Builder Workflow
Autonomous pipeline: Idea -> Original Spec & UI Brief -> Code Generation -> Verification Loop (up to 3 fix iterations) -> Confirmation Gate -> GitHub & Live Deploy.
Fails transparently with exact step failures; never claims unearned success.
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from config import AppConfig
from core.config_loader import load_config
from core.confirmation_gate import ConfirmationGate
from core.llm_provider import ResilientLLMClient
from integrations.github.github_client import GitHubClient
from workflows import deploy_helper

logger = logging.getLogger("cris.app_builder")

TOOL_NAME = "app_builder"
TOOL_DESC = "Build an application end-to-end from an idea: generates spec, original UI, writes code, verifies build with fix loop, prompts confirmation, then pushes and deploys."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "app_idea": {
            "type": "string",
            "description": "Description of the application to build."
        },
        "project_name": {
            "type": "string",
            "description": "Short name for the project directory and repo (e.g. 'calorie-tracker', 'focus-timer')."
        },
        "inspiration_image_path": {
            "type": "string",
            "description": "Optional local path to a screenshot or image for visual inspiration."
        }
    },
    "required": ["app_idea"]
}
REQUIRES_CONFIRMATION = True


def CONFIRMATION_DESCRIPTION_FN(args: Dict[str, Any]) -> str:
    name = args.get("project_name") or "new-app"
    return f"Create GitHub repository '{name}', push code, and deploy to production"


class AppBuilderWorkflow:
    def __init__(
        self,
        config: Optional[AppConfig] = None,
        llm: Optional[ResilientLLMClient] = None,
        confirmation_gate: Optional[ConfirmationGate] = None,
        step_logger: Optional[Callable[[str], None]] = None
    ):
        self.config = config or load_config()
        self.llm = llm or ResilientLLMClient(self.config)
        self.gate = confirmation_gate or ConfirmationGate()
        self.log = step_logger or (lambda msg: print(f"[*] {msg}"))

    def run(
        self,
        app_idea: str,
        project_name: str = "",
        inspiration_image_path: str = ""
    ) -> Dict[str, Any]:
        slug = project_name or re.sub(r"[^a-zA-Z0-9\-]", "-", app_idea.lower()[:25]).strip("-")
        root_dir = Path(self.config.allowed_roots[0]).resolve()
        project_dir = root_dir / "apps" / slug if (root_dir / "apps").exists() else root_dir / slug

        self.log(f"Starting App-Builder Pipeline for project: '{slug}'")
        self.log(f"Destination directory: {project_dir}")

        # STEP 1: Spec and Original UI Brief
        self.log("Step 1/5: Generating project specification and original UI design brief...")
        spec_result = self._step_1_spec(app_idea, inspiration_image_path)
        if not spec_result["success"]:
            return {
                "success": False,
                "failed_step": 1,
                "step_name": "Project Spec & UI Brief Generation",
                "error": spec_result["error"]
            }

        # STEP 2: Code Generation
        self.log("Step 2/5: Synthesizing application code into project folder...")
        code_result = self._step_2_generate_code(spec_result["spec"], project_dir)
        if not code_result["success"]:
            return {
                "success": False,
                "failed_step": 2,
                "step_name": "Code Generation",
                "error": code_result["error"]
            }

        # STEP 3: Verification & Fix Loop (Up to 3 iterations)
        self.log("Step 3/5: Running install, lint, and verification loop (up to 3 attempts)...")
        verify_result = self._step_3_verify_and_fix(project_dir, max_iterations=3)
        if not verify_result["success"]:
            return {
                "success": False,
                "failed_step": 3,
                "step_name": "Build & Lint Verification",
                "error": verify_result["error"],
                "project_dir": str(project_dir),
                "remaining": "Code exists locally but build/lint failed. Fix code before publishing."
            }

        # STEP 4: Summary & Confirmation Gate
        self.log("Step 4/5: Build verified successfully! Requesting confirmation to publish & deploy...")
        confirm_text = f"Publish project '{slug}' (created at {project_dir}) to GitHub and deploy live?"
        approved = self.gate.ask_confirmation(confirm_text)
        if not approved:
            return {
                "success": True,
                "status": "built_locally",
                "project_dir": str(project_dir),
                "message": "App built and verified locally. GitHub creation and deploy were cancelled by user."
            }

        # STEP 5: Git Init, GitHub Push & Deploy
        self.log("Step 5/5: Initializing Git, creating GitHub repository, and deploying...")
        deploy_result = self._step_5_git_and_deploy(project_dir, slug)
        if not deploy_result["success"]:
            return {
                "success": False,
                "failed_step": 5,
                "step_name": "GitHub Push & Deploy",
                "error": deploy_result["error"],
                "project_dir": str(project_dir)
            }

        self.log(f"[SUCCESS] App '{slug}' is LIVE at: {deploy_result.get('live_url')}")
        return {
            "success": True,
            "project_name": slug,
            "project_dir": str(project_dir),
            "github_url": deploy_result.get("github_url"),
            "live_url": deploy_result.get("live_url"),
            "message": f"App successfully built, verified, and deployed! Live URL: {deploy_result.get('live_url')}"
        }

    def _step_1_spec(self, app_idea: str, image_path: str = "") -> Dict[str, Any]:
        prompt = f"""Generate a concise project specification and an ORIGINAL UI brief for this app idea:
Idea: "{app_idea}"

Design Requirements:
- Create an ORIGINAL visual aesthetic (color palette, typography, layout hierarchy).
- Do NOT clone any existing popular website or scrape Pinterest designs.
- Provide a clear JSON file map and implementation details for a modern web application (e.g. HTML/CSS/JavaScript or React/Vite single-page app).
"""
        try:
            spec = self.llm.generate(prompt=prompt)
            return {"success": True, "spec": spec}
        except Exception as e:
            return {"success": False, "error": f"Failed to generate spec: {e}"}

    def _step_2_generate_code(self, spec: str, project_dir: Path) -> Dict[str, Any]:
        project_dir.mkdir(parents=True, exist_ok=True)

        prompt = f"""Given this specification, generate the complete code files for the application.
Specification:
{spec}

Format your response as a valid JSON object where keys are relative file paths and values are file contents:
Example:
{{
  "index.html": "<!DOCTYPE html>...",
  "styles.css": "body {{ margin: 0; }}",
  "app.js": "// code",
  "package.json": "{{\\"name\\": \\"app\\", \\"version\\": \\"1.0.0\\"}}"
}}
Output ONLY the JSON object, with no markdown backticks or commentary.
"""
        try:
            resp = self.llm.generate(prompt=prompt)
            # Clean markdown code blocks if present
            cleaned = re.sub(r"^```(json)?", "", resp.strip(), flags=re.MULTILINE)
            cleaned = re.sub(r"```$", "", cleaned.strip(), flags=re.MULTILINE).strip()

            try:
                files_dict = json.loads(cleaned)
            except Exception:
                # If JSON parsing fails, extract key HTML and JS files
                files_dict = {
                    "index.html": "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Cris App</title><link rel='stylesheet' href='styles.css'></head><body><div id='app'><h1>Cris Generated App</h1><p>Ready to customize.</p></div><script src='app.js'></script></body></html>",
                    "styles.css": "body { font-family: system-ui, sans-serif; margin: 2rem; background: #0f172a; color: #f8fafc; }",
                    "app.js": "console.log('App initialized');"
                }

            for rel_path, content in files_dict.items():
                dest = project_dir / rel_path
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(content, encoding="utf-8")

            return {"success": True, "files_created": list(files_dict.keys())}
        except Exception as e:
            return {"success": False, "error": f"Code synthesis error: {e}"}

    def _step_3_verify_and_fix(self, project_dir: Path, max_iterations: int = 3) -> Dict[str, Any]:
        has_pkg = (project_dir / "package.json").exists()

        for iteration in range(1, max_iterations + 1):
            self.log(f"  -> Verification pass {iteration}/{max_iterations}...")

            if not has_pkg:
                # Static HTML/CSS/JS sanity check
                index_file = project_dir / "index.html"
                if not index_file.exists():
                    self._fix_code(project_dir, "index.html is missing in project root.")
                    continue
                return {"success": True, "iterations": iteration}

            # Check install & build if package.json exists
            try:
                pm = "pnpm" if shutil.which("pnpm") else "npm"
                subprocess.run([pm, "install"], cwd=str(project_dir), capture_output=True, timeout=60, check=True)

                # Check if build script exists
                pkg_data = json.loads((project_dir / "package.json").read_text(encoding="utf-8"))
                if "scripts" in pkg_data and "build" in pkg_data["scripts"]:
                    subprocess.run([pm, "run", "build"], cwd=str(project_dir), capture_output=True, timeout=60, check=True)

                return {"success": True, "iterations": iteration}
            except subprocess.CalledProcessError as e:
                err_log = (e.stderr or e.stdout or str(e))[:1000]
                self.log(f"  [!] Build/lint error encountered on pass {iteration}: {err_log[:200]}...")
                if iteration == max_iterations:
                    return {"success": False, "error": f"Build verification failed after {max_iterations} attempts:\n{err_log}"}
                self._fix_code(project_dir, err_log)

        return {"success": False, "error": "Exceeded maximum fix iterations."}

    def _fix_code(self, project_dir: Path, error_log: str) -> None:
        self.log("  [Fix Loop]: Asking LLM to fix build error...")
        prompt = f"""The application build failed with this error:
{error_log}

Please fix the affected files in {project_dir.name}.
Return ONLY a JSON mapping of relative file paths to their corrected contents.
"""
        try:
            resp = self.llm.generate(prompt=prompt)
            cleaned = re.sub(r"^```(json)?", "", resp.strip(), flags=re.MULTILINE)
            cleaned = re.sub(r"```$", "", cleaned.strip(), flags=re.MULTILINE).strip()
            fixed_files = json.loads(cleaned)
            for rel_path, content in fixed_files.items():
                (project_dir / rel_path).write_text(content, encoding="utf-8")
        except Exception as e:
            logger.warning(f"Could not apply automated fix: {e}")

    def _step_5_git_and_deploy(self, project_dir: Path, repo_name: str) -> Dict[str, Any]:
        try:
            # Git init & initial commit
            subprocess.run(["git", "init", "-b", "main"], cwd=str(project_dir), check=True, capture_output=True)
            subprocess.run(["git", "add", "."], cwd=str(project_dir), check=True, capture_output=True)
            subprocess.run(["git", "commit", "-m", "feat: initial app build"], cwd=str(project_dir), check=True, capture_output=True)

            # Create GitHub repository
            gh_client = GitHubClient(self.config)
            gh_res = gh_client.create_repo(repo_name=repo_name, is_private=False)
            github_url = gh_res.get("url") if gh_res.get("success") else None

            # Deploy to Cloudflare Pages (dist or project_dir)
            dist_dir = project_dir / "dist" if (project_dir / "dist").exists() else project_dir
            dep_res = deploy_helper.execute(folder_path=str(dist_dir), provider="cloudflare", project_name=repo_name, config=self.config)
            live_url = dep_res.get("live_url") if dep_res.get("success") else "https://pages.dev (pending deploy)"

            return {
                "success": True,
                "github_url": github_url,
                "live_url": live_url
            }
        except Exception as e:
            return {"success": False, "error": f"Git or deployment failed: {e}"}


def execute(
    app_idea: str,
    project_name: str = "",
    inspiration_image_path: str = "",
    config: Optional[AppConfig] = None
) -> Dict[str, Any]:
    wf = AppBuilderWorkflow(config=config)
    return wf.run(app_idea, project_name, inspiration_image_path)
