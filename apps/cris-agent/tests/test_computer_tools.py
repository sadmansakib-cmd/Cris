"""
Tests for Safe Computer Tools.
"""

from config import AppConfig
from core.kill_switch import KillSwitch
from tools import open_app, system_status, keyboard_mouse


def test_open_app_security():
    config = AppConfig(app_allowlist=["notepad.exe", "calc.exe"])

    # 1. Metacharacter injection rejection
    res1 = open_app.execute("notepad.exe; calc.exe", config=config)
    assert res1["success"] is False
    assert "prohibited metacharacters" in res1["error"].lower()

    res2 = open_app.execute("notepad.exe | whoami", config=config)
    assert res2["success"] is False
    assert "prohibited metacharacters" in res2["error"].lower()

    # 2. Allowlist rejection
    res3 = open_app.execute("powershell.exe", config=config)
    assert res3["success"] is False
    assert "not in the allowed application list" in res3["error"]


def test_system_status():
    res = system_status.execute()
    assert res["success"] is True
    assert "disk_c" in res["metrics"]
    assert res["metrics"]["disk_c"]["total_gb"] > 0


def test_keyboard_mouse_kill_switch():
    ks = KillSwitch.get_instance()
    ks.reset()

    from unittest.mock import patch

    # Mock pyautogui so no real typing occurs during testing
    with patch("pyautogui.write") as mock_write:
        res = keyboard_mouse.execute(action="type", text="hello")
        assert res["success"] is True
        assert mock_write.call_count == len("hello")

    # Trigger kill switch
    ks.trigger()
    with patch("pyautogui.write") as mock_write:
        res_aborted = keyboard_mouse.execute(action="type", text="world")
        assert res_aborted["success"] is False
        assert "aborted" in res_aborted["error"].lower()
        mock_write.assert_not_called()

    ks.reset()
