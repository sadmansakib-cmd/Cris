"""
Cris Agent - System Status Tool
Monitors CPU, Memory, Disk, and Battery metrics.
"""

from __future__ import annotations

import shutil
from typing import Any, Dict

TOOL_NAME = "system_status"
TOOL_DESC = "Check computer system health: CPU usage, RAM utilization, Disk space, and Battery status."
TOOL_PARAMS = {
    "type": "object",
    "properties": {}
}
REQUIRES_CONFIRMATION = False


def execute() -> Dict[str, Any]:
    stats: Dict[str, Any] = {}

    # Disk usage
    total, used, free = shutil.disk_usage("C:\\")
    stats["disk_c"] = {
        "total_gb": round(total / (1024**3), 2),
        "used_gb": round(used / (1024**3), 2),
        "free_gb": round(free / (1024**3), 2),
        "percent_used": round((used / total) * 100, 1)
    }

    try:
        import psutil
        stats["cpu_percent"] = psutil.cpu_percent(interval=0.2)
        mem = psutil.virtual_memory()
        stats["ram"] = {
            "total_gb": round(mem.total / (1024**3), 2),
            "available_gb": round(mem.available / (1024**3), 2),
            "percent_used": mem.percent
        }
        battery = psutil.sensors_battery()
        if battery:
            stats["battery"] = {
                "percent": battery.percent,
                "power_plugged": battery.power_plugged,
                "secsleft": battery.secsleft
            }
        else:
            stats["battery"] = "Desktop PC / No battery sensor"
    except ImportError:
        # Fallback if psutil is not yet installed in local environment
        stats["cpu_percent"] = "Available via psutil"
        stats["ram"] = "Available via psutil"

    return {"success": True, "metrics": stats}
