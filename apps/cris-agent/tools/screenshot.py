"""
Cris Agent - Screenshot Tool
Captures the primary monitor and saves to data/screenshots.
"""

from __future__ import annotations

import datetime
from pathlib import Path
from typing import Any, Dict
from config import AppConfig
from core.config_loader import load_config

TOOL_NAME = "screenshot"
TOOL_DESC = "Capture a screenshot of the computer screen and save it to disk."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "filename": {
            "type": "string",
            "description": "Optional name for image file (default: timestamped PNG)."
        }
    }
}
REQUIRES_CONFIRMATION = False


def execute(filename: str = "", config: AppConfig | None = None) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    screenshots_dir = config.data_dir / "screenshots"
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    if not filename:
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"screenshot_{ts}.png"

    if not filename.endswith(".png"):
        filename += ".png"

    save_path = screenshots_dir / filename

    # Attempt PIL ImageGrab, else fallback to PowerShell
    try:
        from PIL import ImageGrab
        img = ImageGrab.grab()
        img.save(str(save_path))
        return {
            "success": True,
            "path": str(save_path),
            "message": f"Screenshot saved to {save_path}"
        }
    except ImportError:
        # PowerShell fallback
        import subprocess
        ps_cmd = f"""
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
        $bitmap.Save('{str(save_path)}')
        $graphics.Dispose()
        $bitmap.Dispose()
        """
        res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=15)
        if res.returncode == 0 and save_path.exists():
            return {
                "success": True,
                "path": str(save_path),
                "message": f"Screenshot saved to {save_path}"
            }
        return {"success": False, "error": f"Screenshot failed: {res.stderr}"}
    except Exception as e:
        return {"success": False, "error": f"Failed to capture screenshot: {e}"}
