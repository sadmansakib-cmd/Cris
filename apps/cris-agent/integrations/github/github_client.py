"""
Cris Agent - GitHub Integration
Leverages 'gh' CLI if available, otherwise falls back to GitHub REST API.
Mutating actions (push, repo creation, PR) require ConfirmationGate.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, Optional
from config import AppConfig
from core.config_loader import load_config

TOOL_NAME = "github_ops"
TOOL_DESC = "Manage GitHub repositories, commits, pull requests, and push code. Pushing requires confirmation."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["create_repo", "commit_and_push", "create_pr", "trigger_workflow"],
            "description": "GitHub action."
        },
        "repo_name": {
            "type": "string",
            "description": "Repository name (for 'create_repo')."
        },
        "commit_message": {
            "type": "string",
            "description": "Commit message (for 'commit_and_push')."
        },
        "pr_title": {
            "type": "string",
            "description": "PR title (for 'create_pr')."
        },
        "pr_body": {
            "type": "string",
            "description": "PR body description."
        },
        "workflow_id": {
            "type": "string",
            "description": "Workflow filename or ID (for 'trigger_workflow')."
        },
        "is_private": {
            "type": "boolean",
            "description": "Create as private repository (default false)."
        }
    },
    "required": ["action"]
}
REQUIRES_CONFIRMATION = True


def CONFIRMATION_DESCRIPTION_FN(args: Dict[str, Any]) -> str:
    action = args.get("action", "")
    if action == "commit_and_push":
        return f"Commit changes and push code to GitHub with message '{args.get('commit_message')}'"
    elif action == "create_repo":
        return f"Create a new {'private' if args.get('is_private') else 'public'} GitHub repository named '{args.get('repo_name')}'"
    elif action == "create_pr":
        return f"Create a GitHub Pull Request: '{args.get('pr_title')}'"
    return f"Execute GitHub action '{action}'"


class GitHubClient:
    def __init__(self, config: Optional[AppConfig] = None):
        self.config = config or load_config()
        self.token = self.config.github_token
        self.has_gh = shutil.which("gh") is not None

    def create_repo(self, repo_name: str, is_private: bool = False) -> Dict[str, Any]:
        if not repo_name:
            return {"success": False, "error": "repo_name is required."}

        # Try gh CLI first
        if self.has_gh:
            vis = "--private" if is_private else "--public"
            cmd = ["gh", "repo", "create", repo_name, vis, "--source=.", "--remote=origin"]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if res.returncode == 0:
                return {
                    "success": True,
                    "repo_name": repo_name,
                    "url": f"https://github.com/{self.config.github_username or 'user'}/{repo_name}",
                    "message": f"Created GitHub repository '{repo_name}' via gh CLI."
                }

        # Fallback to GitHub REST API
        if not self.token:
            return {
                "success": False,
                "error": "gh CLI failed or not installed, and GITHUB_TOKEN is not configured in .env."
            }

        url = "https://api.github.com/user/repos"
        payload = json.dumps({"name": repo_name, "private": is_private}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": f"token {self.token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "CrisAgent"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return {
                    "success": True,
                    "repo_name": repo_name,
                    "url": data.get("html_url"),
                    "clone_url": data.get("clone_url"),
                    "message": f"Created GitHub repository '{repo_name}' via REST API."
                }
        except urllib.error.HTTPError as e:
            return {"success": False, "error": f"GitHub API error {e.code}: {e.read().decode('utf-8')}"}
        except Exception as e:
            return {"success": False, "error": f"Failed to create repo: {e}"}

    def commit_and_push(self, commit_message: str, branch: str = "main") -> Dict[str, Any]:
        if not commit_message:
            return {"success": False, "error": "commit_message is required."}

        try:
            # Stage all changes
            subprocess.run(["git", "add", "."], check=True, capture_output=True, text=True)
            # Commit
            subprocess.run(["git", "commit", "-m", commit_message], check=True, capture_output=True, text=True)
            # Push
            push_res = subprocess.run(["git", "push", "-u", "origin", branch], check=True, capture_output=True, text=True)
            return {
                "success": True,
                "message": f"Successfully committed and pushed to origin/{branch}."
            }
        except subprocess.CalledProcessError as e:
            return {"success": False, "error": f"Git command failed: {e.stderr or e}"}
        except Exception as e:
            return {"success": False, "error": f"Push error: {e}"}

    def create_pr(self, title: str, body: str = "", base: str = "main") -> Dict[str, Any]:
        if not title:
            return {"success": False, "error": "PR title is required."}

        if self.has_gh:
            cmd = ["gh", "pr", "create", "--title", title, "--body", body, "--base", base]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if res.returncode == 0:
                return {"success": True, "output": res.stdout.strip(), "message": f"PR created: {title}"}
            return {"success": False, "error": f"gh pr create failed: {res.stderr}"}

        return {"success": False, "error": "gh CLI is required to create PRs without full git tree context."}


def execute(
    action: str,
    repo_name: str = "",
    commit_message: str = "",
    pr_title: str = "",
    pr_body: str = "",
    workflow_id: str = "",
    is_private: bool = False,
    config: Optional[AppConfig] = None
) -> Dict[str, Any]:
    client = GitHubClient(config)
    action = action.lower()

    if action == "create_repo":
        return client.create_repo(repo_name, is_private)
    elif action == "commit_and_push":
        return client.commit_and_push(commit_message)
    elif action == "create_pr":
        return client.create_pr(pr_title, pr_body)

    return {"success": False, "error": f"Unknown GitHub action: {action}"}
