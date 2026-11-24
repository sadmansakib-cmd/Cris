"""
Tests for Config and Path/App Allowlist validation.
"""

from pathlib import Path
from config import AppConfig
from core.config_loader import load_config


def test_config_defaults():
    config = load_config()
    assert config.mode in ("pipeline", "live", "text")
    assert config.gemini_model != ""
    assert config.voice.wake_word_phrase == "Hey Cris"
    assert config.voice.silence_timeout_seconds == 20
    assert config.confirmation_timeout_seconds == 30


def test_is_path_allowed():
    base_dir = Path(__file__).parent.parent.resolve()
    config = AppConfig(
        allowed_roots=[str(base_dir)]
    )

    # Allowed inside base_dir
    inside_path = base_dir / "data" / "test.txt"
    assert config.is_path_allowed(inside_path) is True

    # Disallowed outside base_dir
    outside_path = Path("C:/Windows/System32/drivers/etc/hosts")
    assert config.is_path_allowed(outside_path) is False


def test_is_app_allowed():
    config = AppConfig(
        app_allowlist=["notepad.exe", "calc.exe", "code.cmd"]
    )
    assert config.is_app_allowed("notepad.exe") is True
    assert config.is_app_allowed("C:\\Windows\\notepad.exe") is True
    assert config.is_app_allowed("calc.exe") is True
    assert config.is_app_allowed("malware.exe") is False
    assert config.is_app_allowed("powershell.exe") is False
