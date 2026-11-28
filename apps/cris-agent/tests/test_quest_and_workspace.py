"""
Tests for Quest Task Tool, Gamified Rank Progression & Web Image Downloader.
"""

from memory.sqlite_store import SQLiteStore
from tools import quest_tool, image_downloader


def test_quest_tool_assign_and_complete_lifecycle():
    store = SQLiteStore(":memory:")

    # 1. Assign Task at Level 3 (100 XP)
    res_assign = quest_tool.execute(
        action="assign",
        title="Morning running",
        intensity=3,
        scheduled_at="2026-11-29 07:00",
        timer_minutes=30,
        store=store
    )
    assert res_assign["success"] is True
    assert res_assign["action"] == "assigned"
    task = res_assign["task"]
    assert task["title"] == "Morning running"
    assert task["intensity"] == 3
    assert task["xp"] == 100
    assert task["done"] is False

    # 2. Check Player Initial Progress
    prog_initial = store.get_player_progress()
    assert prog_initial["total_xp"] == 0
    assert prog_initial["rank_title"] == "E-Rank Novice"

    # 3. Complete Task
    res_complete = quest_tool.execute(
        action="complete",
        title="Morning running",
        store=store
    )
    assert res_complete["success"] is True
    assert res_complete["action"] == "completed"
    assert res_complete["xp_gained"] == 100
    assert res_complete["total_xp"] == 100
    assert res_complete["rank"] == "D-Rank Apprentice"

    # 4. List Tasks
    res_list = quest_tool.execute(action="list", store=store)
    assert res_list["success"] is True
    assert res_list["count"] == 1
    assert res_list["tasks"][0]["done"] == 1


def test_image_downloader_creates_file():
    """Verify image downloader saves an image into data/downloads/."""
    res = image_downloader.execute(query="test_robot", filename="test_robot_img.jpg")
    assert res["success"] is True
    assert "test_robot_img.jpg" in res["filename"]
    assert res["size_kb"] > 0
