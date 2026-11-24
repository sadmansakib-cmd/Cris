"""
Cris Agent - Audio Device Selection & Diagnostics
Enumerates system audio inputs and outputs.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("cris.audio")


def list_audio_devices() -> Dict[str, List[Dict[str, Any]]]:
    """List available audio input and output devices."""
    inputs = []
    outputs = []

    try:
        import sounddevice as sd
        devices = sd.query_devices()
        for i, dev in enumerate(devices):
            item = {
                "index": i,
                "name": dev["name"],
                "max_input_channels": dev["max_input_channels"],
                "max_output_channels": dev["max_output_channels"],
                "default_samplerate": dev["default_samplerate"]
            }
            if dev["max_input_channels"] > 0:
                inputs.append(item)
            if dev["max_output_channels"] > 0:
                outputs.append(item)
    except ImportError:
        logger.info("Optional package 'sounddevice' not installed. System defaults will be used.")
    except Exception as e:
        logger.warning(f"Error querying audio devices: {e}")

    return {"inputs": inputs, "outputs": outputs}


def get_default_device(kind: str = "input", configured_index: Optional[int] = None) -> Optional[int]:
    """Get the active audio device index."""
    if configured_index is not None:
        return configured_index
    try:
        import sounddevice as sd
        default = sd.default.device
        try:
            val = default[0] if kind == "input" else default[1]
            return int(val)
        except (TypeError, IndexError, ValueError, KeyError):
            return int(default) if isinstance(default, int) else None
    except Exception:
        return None
