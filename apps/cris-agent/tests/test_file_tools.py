"""
Tests for Safe File Tools and Root Boundary Enforcement.
"""

import tempfile
from pathlib import Path
from unittest.mock import patch
from config import AppConfig
from tools import file_search, file_read, file_write, file_copy, file_move, file_delete


def test_file_tools_boundary_and_operations():
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_root = Path(tmp_dir).resolve()
        config = AppConfig(allowed_roots=[str(tmp_root)])

        test_file = tmp_root / "sample.txt"
        copy_file = tmp_root / "sample_copy.txt"
        moved_file = tmp_root / "sample_moved.txt"

        # 1. Write file
        res_write = file_write.execute(str(test_file), "Hello Cris Agent\nLine 2", config=config)
        assert res_write["success"] is True
        assert test_file.exists()

        # 2. Path traversal rejection
        evil_path = tmp_root / ".." / "system.ini"
        res_evil = file_write.execute(str(evil_path), "malicious content", config=config)
        assert res_evil["success"] is False
        assert "outside allowed directories" in res_evil["error"].lower()

        # 3. Read file
        res_read = file_read.execute(str(test_file), config=config)
        assert res_read["success"] is True
        assert "Hello Cris Agent" in res_read["content"]

        # 4. Search file
        res_search = file_search.execute("*.txt", search_path=str(tmp_root), config=config)
        assert res_search["success"] is True
        assert res_search["count"] >= 1

        # 5. Copy file
        res_copy = file_copy.execute(str(test_file), str(copy_file), config=config)
        assert res_copy["success"] is True
        assert copy_file.exists()

        # 6. Move file
        res_move = file_move.execute(str(copy_file), str(moved_file), config=config)
        assert res_move["success"] is True
        assert moved_file.exists()
        assert not copy_file.exists()

        # 7. Delete file (mocking recycling to ensure no permanent delete)
        with patch("subprocess.run") as mock_sub:
            mock_sub.return_value.returncode = 0
            # Remove target to simulate successful recycling
            moved_file.unlink()
            res_delete = file_delete.execute(str(moved_file), config=config)
            # Since moved_file was removed, file does not exist check or mock
            assert res_delete["success"] is False or "not exist" in res_delete.get("error", "")

        # Test valid delete path with mock
        dummy_file = tmp_root / "dummy.txt"
        dummy_file.write_text("delete me", encoding="utf-8")
        with patch("subprocess.run") as mock_sub:
            mock_sub.return_value.returncode = 0
            with patch.dict("sys.modules", {"send2trash": None}):
                # Simulate PowerShell fallback
                def fake_run(*args, **kwargs):
                    if dummy_file.exists():
                        dummy_file.unlink()
                    class MockRes:
                        returncode = 0
                        stderr = ""
                    return MockRes()
                with patch("subprocess.run", side_effect=fake_run):
                    res_del = file_delete.execute(str(dummy_file), config=config)
                    assert res_del["success"] is True
                    assert "recycle bin" in res_del["message"].lower()
