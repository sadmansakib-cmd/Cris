"""
Tests for Local Server Hardening & Security Controls (Part 0).
"""

import json
import secrets
import urllib.error
import urllib.request
from http.server import HTTPServer
import threading
import time

from web_ui import CrisWebHandler, BIND_HOST, check_origin_and_host, validate_token
from core.confirmation_gate import ConfirmationGate


def test_server_bind_host_is_loopback_only():
    """Verify server configuration strictly binds to loopback (127.0.0.1), never 0.0.0.0."""
    assert BIND_HOST == "127.0.0.1", f"Server must bind to 127.0.0.1 only, found: {BIND_HOST}"
    assert BIND_HOST != "0.0.0.0", "SECURITY VIOLATION: Server bound to 0.0.0.0"


def test_host_and_origin_validation():
    """Verify anti-DNS rebinding and anti-CSRF header validation."""
    port = 8000
    
    # Valid Host headers
    assert check_origin_and_host({"Host": "127.0.0.1:8000"}, port) is True
    assert check_origin_and_host({"Host": "localhost:8000"}, port) is True
    assert check_origin_and_host({"Host": "127.0.0.1"}, port) is True
    assert check_origin_and_host({"Host": "localhost"}, port) is True

    # Malicious Host headers (DNS rebinding)
    assert check_origin_and_host({"Host": "evil.com"}, port) is False
    assert check_origin_and_host({"Host": "attacker.site:8000"}, port) is False
    assert check_origin_and_host({"Host": "192.168.1.50:8000"}, port) is False

    # Valid Origin headers
    assert check_origin_and_host({"Host": "127.0.0.1:8000", "Origin": "http://127.0.0.1:8000"}, port) is True
    assert check_origin_and_host({"Host": "localhost:8000", "Origin": "http://localhost:8000"}, port) is True

    # Malicious Origin headers (CSRF)
    assert check_origin_and_host({"Host": "127.0.0.1:8000", "Origin": "http://evil.com"}, port) is False
    assert check_origin_and_host({"Host": "127.0.0.1:8000", "Origin": "http://attacker.org:8000"}, port) is False


def test_token_validation_logic():
    """Verify token validation requirements for all API requests."""
    server_token = secrets.token_urlsafe(32)
    
    # Missing token -> Rejected
    assert validate_token({}, "", server_token) is False
    
    # Wrong token in header -> Rejected
    assert validate_token({"X-Cris-Token": "wrong_token"}, "", server_token) is False
    assert validate_token({"Authorization": "Bearer bad_token"}, "", server_token) is False
    
    # Wrong token in query -> Rejected
    assert validate_token({}, "/api/status?token=wrong_token", server_token) is False
    
    # Valid token in header -> Accepted
    assert validate_token({"X-Cris-Token": server_token}, "", server_token) is True
    assert validate_token({"Authorization": f"Bearer {server_token}"}, "", server_token) is True
    
    # Valid token in query -> Accepted
    assert validate_token({}, f"/api/status?token={server_token}", server_token) is True


def test_approvals_rejected_from_untrusted_sources():
    """Verify approvals from untrusted sources (page content, tool output, email) fail closed."""
    gate = ConfirmationGate.get_instance()
    
    untrusted_sources = [
        "page_content",
        "email_content",
        "tool_output",
        "llm_generation",
        "untrusted_web",
        "attacker"
    ]
    
    for src in untrusted_sources:
        result = gate.resolve_request("dummy_id", approve=True, source=src)
        assert result is False, f"Gate must reject approval from untrusted source: {src}"
