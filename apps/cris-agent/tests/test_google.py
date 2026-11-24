"""
Tests for Google Integrations: Calendar, Gmail, and Drive with boundary and confirmation validation.
"""

from pathlib import Path
from unittest.mock import patch, MagicMock

from config import AppConfig
from integrations.google import calendar_tool, gmail_tool, drive_tool


def test_google_unauthenticated_error():
    cfg = AppConfig()
    # In test environment with no credentials, tools report clean error without crashing
    res_cal = calendar_tool.execute("list", config=cfg)
    assert res_cal["success"] is False
    assert "not authenticated" in res_cal["error"].lower()

    res_mail = gmail_tool.execute("read", config=cfg)
    assert res_mail["success"] is False
    assert "not authenticated" in res_mail["error"].lower()

    res_drive = drive_tool.execute("search", config=cfg)
    assert res_drive["success"] is False
    assert "not authenticated" in res_drive["error"].lower()


def test_gmail_confirmation_contract():
    # Verify confirmation requirement and description generator
    assert gmail_tool.REQUIRES_CONFIRMATION is True
    desc = gmail_tool.CONFIRMATION_DESCRIPTION_FN({
        "action": "send",
        "to": "boss@company.com",
        "subject": "Quarterly Report"
    })
    assert "boss@company.com" in desc
    assert "Quarterly Report" in desc


def test_drive_boundary_enforcement():
    cfg = AppConfig(allowed_roots=["d:/halt/apps/cris-agent/data"])

    # Attempting to download outside allowed_roots is blocked before network request or credential load
    res = drive_tool.execute(
        "download",
        file_id="12345",
        dest_path="C:/Windows/System32/evil.dll",
        config=cfg
    )
    assert res["success"] is False
    assert "outside allowed directories" in res["error"].lower()
