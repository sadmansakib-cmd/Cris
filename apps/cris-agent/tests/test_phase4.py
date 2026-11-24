"""
Tests for Phase 4: Web, Productivity, and Browser Tools.
"""

import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

from config import AppConfig
from tools import (
    web_search,
    fetch_page,
    weather,
    notes_tool,
    reminders_tool,
    tasks_tool,
    timers_tool,
    daily_briefing,
    browser_automation
)


def test_fetch_page_validation_and_stripping():
    # URL format validation
    res = fetch_page.execute("ftp://invalid.com")
    assert res["success"] is False

    # Mocked HTML fetch
    mock_html = "<html><head><script>alert('bad')</script></head><body><h1>Title</h1><p>Clean text.</p></body></html>"
    with patch("urllib.request.urlopen") as mock_url:
        mock_resp = MagicMock()
        mock_resp.read.return_value = mock_html.encode("utf-8")
        mock_resp.headers = {"Content-Type": "text/html"}
        mock_url.return_value.__enter__.return_value = mock_resp

        res_ok = fetch_page.execute("https://example.com/test")
        assert res_ok["success"] is True
        assert "Clean text." in res_ok["text"]
        assert "alert" not in res_ok["text"]
        assert "UNTRUSTED EXTERNAL DATA" in res_ok["boundary_notice"]


def test_productivity_tools_lifecycle():
    with tempfile.TemporaryDirectory() as tmp_dir:
        db_path = Path(tmp_dir) / "test_prod.db"
        cfg = AppConfig(base_dir=Path(tmp_dir))
        cfg.sqlite_db_path = db_path

        # 1. Notes
        n_res = notes_tool.execute("add", title="Meeting Note", content="Discuss roadmaps", config=cfg)
        assert n_res["success"] is True
        nid = n_res["note_id"]
        assert notes_tool.execute("list", query="roadmaps", config=cfg)["count"] == 1
        assert notes_tool.execute("delete", note_id=nid, config=cfg)["success"] is True

        # 2. Reminders
        with patch("tools.reminders_tool._send_windows_toast"):
            r_res = reminders_tool.execute("add", message="Standup call", due_at="10:00 AM", config=cfg)
            assert r_res["success"] is True
            rid = r_res["reminder_id"]
            assert reminders_tool.execute("list", config=cfg)["count"] == 1
            assert reminders_tool.execute("complete", reminder_id=rid, config=cfg)["success"] is True

        # 3. Tasks
        t_res = tasks_tool.execute("add", title="Write docs", priority="high", config=cfg)
        assert t_res["success"] is True
        tid = t_res["task_id"]
        assert tasks_tool.execute("update", task_id=tid, status="done", config=cfg)["success"] is True
        assert tasks_tool.execute("delete", task_id=tid, config=cfg)["success"] is True

        # 4. Daily Briefing
        with patch("tools.weather.execute") as mock_weather:
            mock_weather.return_value = {"summary": "28C Sunny"}
            brief_res = daily_briefing.execute(city="Dhaka", config=cfg)
            assert brief_res["success"] is True
            assert "Daily Briefing" in brief_res["briefing_text"]


def test_timers_tool():
    # Negative duration rejected
    assert timers_tool.execute(-5)["success"] is False
    # Valid timer dispatches background thread without blocking
    with patch("threading.Thread.start"):
        res = timers_tool.execute(60, "Tea")
        assert res["success"] is True
        assert "Tea" in res["message"]


def test_browser_automation_profile_isolation():
    cfg = AppConfig()
    # Profile directory must be inside data/browser_profile and NOT user Chrome folder
    assert "browser_profile" in str(cfg.browser_profile_dir)
    assert "AppData\\Local\\Google\\Chrome" not in str(cfg.browser_profile_dir)
