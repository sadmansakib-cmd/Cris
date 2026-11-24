"""
Cris Agent - Static Deployment Helper
Deploys static site folders to Cloudflare Pages or Netlify via their official CLIs.
Strictly requires confirmation through ConfirmationGate.
Folder paths must be within allowed_roots.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional
from config import AppConfig
from core.config_loader import load_config

TOOL_NAME = "deploy_helper"
TOOL_DESC = "Deploy a static web folder to Cloudflare Pages or Netlify. Requires user confirmation."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "folder_path": {
            "type": "string",
            "description": "Path to the static build directory (e.g. dist, build, public)."
        },
        "provider": {
            "type": "string",
            "enum": ["cloudflare", "netlify"],
            "description": "Deployment target platform (default: cloudflare)."
        },
        "project_name": {
            "type": "string",
            "description": "Project name on Cloudflare Pages / Netlify."
        }
    },
    "required": ["folder_path"]
}
REQUIRES_CONFIRMATION = True


def CONFIRMATION_DESCRIPTION_FN(args: Dict[str, Any]) -> str:
    folder = args.get("folder_path", "")
    provider = args.get("provider", "cloudflare").capitalize()
    return f"Deploy directory '{folder}' to {provider} production"


def execute(
    folder_path: str,
    provider: str = "cloudflare",
    project_name: str = "",
    config: Optional[AppConfig] = None
) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    target = Path(folder_path).resolve()
    if not config.is_path_allowed(target):
        return {
            "success": False,
            "error": f"Access Denied: Folder '{target}' is outside allowed directories."
        }

    if not target.exists() or not target.is_dir():
        return {"success": False, "error": f"Directory not found: {target}"}

    provider = provider.lower()
    proj_name = project_name or target.name

    if provider == "cloudflare":
        # Using wrangler CLI
        cmd = ["npx", "wrangler", "pages", "deploy", str(target), f"--project-name={proj_name}"]
    elif provider == "netlify":
        # Using netlify CLI
        cmd = ["npx", "netlify", "deploy", f"--dir={str(target)}", "--prod"]
    else:
        return {"success": False, "error": f"Unsupported deployment provider: '{provider}'"}

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        stdout = proc.stdout
        stderr = proc.stderr

        # Extract live deployment URL from output
        url_match = re.search(r"https://[a-zA-Z0-9\-\.\_]+\.(pages\.dev|netlify\.app)", stdout)
        live_url = url_match.group(0) if url_match else f"https://{proj_name}.pages.dev"

        if proc.returncode == 0:
            return {
                "success": True,
                "provider": provider,
                "live_url": live_url,
                "project_name": proj_name,
                "message": f"Successfully deployed to {provider}! Live at: {live_url}"
            }
        else:
            return {
                "success": False,
                "error": f"Deployment CLI failed with exit code {proc.returncode}: {stderr or stdout}"
            }
    except Exception as e:
        return {"success": False, "error": f"Deployment execution error: {e}"}
