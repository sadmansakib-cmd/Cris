# Cris Agent - Security Architecture & Hardening Guide

## Overview

Cris is a local-first autonomous PC assistant designed to control system tools, run browser workflows, and integrate with cloud services (Google Workspace, GitHub). Because Cris has the ability to interact with the underlying operating system and execute automation, the local server and tool runtime are treated as a strict **Security Boundary**.

This document outlines the security controls, hardening measures, and trust boundaries enforced across Cris v1.3.

---

## 1. Local Server Hardening (HTTP & WebSocket)

The Arc Reactor HUD and API server (`apps/cris-agent/web_ui.py`) run as a local web service. To prevent remote access, Cross-Site Request Forgery (CSRF), and DNS rebinding attacks, the following controls are strictly enforced:

### A. Loopback Binding Only
- The HTTP server binds exclusively to `127.0.0.1` (`localhost`).
- Binding to `0.0.0.0` or any external/public network interface is strictly prohibited and blocked by automated unit tests (`tests/test_server_security.py`).
- External machines on the local LAN cannot reach the Cris server.

### B. Per-Launch Ephemeral Token Authentication
- On every startup, Cris generates a cryptographically secure random 256-bit token (`secrets.token_urlsafe(32)`).
- **All** incoming HTTP requests and WebSocket/streaming connections require this token:
  - Passed via the `X-Cris-Token` HTTP header, `Authorization: Bearer <token>`, or `?token=<token>` query parameter.
  - The UI shell (`/`) requires the valid `?token=` parameter to load and automatically injects it into client-side API requests.
  - Any request with a missing or invalid token is immediately rejected with `401 Unauthorized`.

### C. Host Header Validation (Anti-DNS Rebinding)
- Attackers attempting DNS rebinding attacks point a malicious domain to `127.0.0.1`.
- Cris validates the `Host` header of every incoming request:
  - Allowed hosts: `127.0.0.1:{port}`, `localhost:{port}`, `127.0.0.1`, `localhost`.
  - Any request with an unapproved or spoofed `Host` header is rejected with `403 Forbidden`.

### D. Origin Header Validation (Anti-CSRF) & No Wildcard CORS
- If an `Origin` header is present, it must strictly match `http://127.0.0.1:{port}` or `http://localhost:{port}`.
- Wildcard CORS (`Access-Control-Allow-Origin: *`) is **strictly forbidden**.
- Browsers loading third-party websites cannot perform background cross-origin fetch requests against the Cris local API.

---

## 2. Non-Bypassable Confirmation Gate

Dangerous and mutating operations cannot be executed autonomously without human consent.

### A. Guaranteed Fail-Closed Behavior
- All actions requiring confirmation (file deletion, sending emails, pushing git commits, deploying apps, cloud mutating calls) enter the `ConfirmationGate`.
- If the user does not respond within the configured timeout (default: 30 seconds), the action is automatically cancelled (`fail-closed`).

### B. Trusted Approval Sources Only
- Approvals are accepted **strictly** from authenticated channels:
  1. Spoken voice response ("yes" / "হ্যাঁ") captured directly by the local microphone session.
  2. Direct user CLI input (`sys.stdin`).
  3. The authenticated HUD Approvals panel (`POST /api/approvals/{id}` with valid launch token).
- Approvals originating from untrusted sources are completely ignored:
  - Text found on web pages (prompt injection defenses).
  - Incoming email body or calendar descriptions.
  - Tool output or synthetic model generations.

---

## 3. Filesystem Sandbox (`allowed_roots`)

- File operations (`file_search`, `file_read`, `file_write`, `file_move`, `file_copy`, `file_delete`) are strictly jailed within directories defined in `ALLOWED_ROOTS` (by default: the workspace repo and the user home directory).
- All paths are canonicalized with `.resolve()` before checking.
- Path traversal sequences (`..`, symlink escapes) outside of `allowed_roots` raise permission errors.
- File deletions are performed strictly through `send2trash` (Recycle Bin), never permanent unrecoverable deletion.

---

## 4. Subprocess & Command Execution Hygiene

- Use of `shell=True` is strictly banned across all tools and agent modules.
- Dynamic evaluation primitives (`eval()`, `exec()`, `os.system()`) are forbidden and enforced via automated AST/grep tests.
- Applications launched via `open_app` are matched against a strict executable allowlist (`notepad.exe`, `calc.exe`, etc.) and checked for shell metacharacters (`&`, `;`, `|`, `` ` ``, `$`).

---

## 5. Web Agent & Untrusted Data Boundaries

- Browser automation runs in an isolated Playwright profile (`data/browser_profile`), never accessing personal browser cookies, saved passwords, or session tokens.
- Blocked domains by default include banking, payment processors, `file://`, and private RFC-1918 IP addresses.
- Login and credential forms immediately pause execution and request human takeover.
- Web content is marked with untrusted delimiters to prevent indirect prompt injection.
- File downloads are restricted to `data/downloads/` and are never automatically executed.

---

## 6. Emergency Kill Switch (`Ctrl+Alt+Q`)

- An instantaneous, non-blocking kill switch is active across the assistant.
- Triggered by pressing `Ctrl+Alt+Q` or clicking the emergency abort button in the HUD.
- Instantly halts active keyboard/mouse automation, browser workflows, and task execution loops.
