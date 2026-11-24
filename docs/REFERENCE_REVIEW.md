# Reference Repository Security & License Review

**Reference Repository:** `https://github.com/adirangel/JARVIS`  
**Review Date:** November 2026  
**Auditor:** Cris Senior Engineering Team  

---

## 1. License Check

- **License Status:** **NO LICENSE FOUND (HTTP 404 / `license: null`)**
- **Verification Details:**
  - Direct request to `https://raw.githubusercontent.com/adirangel/JARVIS/main/LICENSE` returned `HTTP 404: Not Found`.
  - GitHub API inspection (`https://api.github.com/repos/adirangel/JARVIS`) confirmed `"license": null`.
  - Repository tree inspection verified no `LICENSE`, `LICENSE.md`, `LICENSE.txt`, or `COPYING` files exist in root or subdirectories.
- **Architectural Action:**
  - In accordance with the project safety protocol: **ZERO code was copied or adapted**.
  - All components, tools, interfaces, and architecture of **Cris** are designed and implemented from scratch in our own original code.

---

## 2. Security Audit & Unsafe Patterns in Reference Code

A deep inspection of the reference repository files revealed several severe security anti-patterns and unsafe operations:

### A. Unsanitized `shell=True` and Command Injection Risks
- **Files:** `tool_registry.py` (lines 760, 876-878, 895, 899, 1053, 1060, 1134, etc.), `agent/agent_manager.py`
- **Pattern:** Using `subprocess.Popen(..., shell=True)` and `subprocess.run(..., shell=True)` passing formatted command strings directly into the Windows Command Prompt / PowerShell.
- **Risk:** Allows command injection through metacharacters (`&`, `;`, `|`, `` ` ``, `$()`). If an attacker or untrusted LLM output produces a malicious app or argument string, arbitrary system commands would execute.
- **Cris Mitigation:** 
  - Strictly banned `shell=True`. 
  - All command invocations use explicit argument lists without a shell wrapper.
  - Strict application allowlist configured in `config.py` with metacharacter rejection.

### B. Arbitrary Dynamic Code Execution (`eval`, `exec`, `os.system`)
- **Files:** `skills/manager.py` (lines 28–31), `skills/loader.py`
- **Pattern:** Loading Python code strings from disk or network and evaluating them dynamically via `eval()` and `exec()`.
- **Risk:** Remote code execution and execution of untrusted code payloads.
- **Cris Mitigation:**
  - Banned any runtime skill or script installer.
  - All tools are statically defined Python modules following a strict contract (`TOOL_NAME`, `TOOL_DESC`, `TOOL_PARAMS`, `execute()`).
  - No `eval()` or `exec()` anywhere in the codebase.

### C. Dangerous Destructive OS Commands
- **Files:** `tool_registry.py` (lines 876-878, 895, 899)
- **Pattern:** Hardcoded commands to force system reboot (`shutdown /r /t 5`), system shutdown (`shutdown /s /t 5`), disabling network adapters (`netsh interface set interface "Wi-Fi" disabled`), and writing raw Windows registry keys.
- **Risk:** Immediate loss of unsaved user work, network cutoff, and system instability.
- **Cris Mitigation:**
  - Explicitly excluded shutdown, restart, and network-disable commands.
  - Any mutating action (file deletion, file moves, sending messages, code commits, deployments) must pass through a strict, fail-closed `ConfirmationGate`.

### D. File Deletions without Safe Recovery
- **Pattern:** Unchecked file removals without recycling bin or folder boundary restrictions.
- **Risk:** Irreversible data loss and path traversal vulnerabilities (`../../`).
- **Cris Mitigation:**
  - All file operations are restricted to `allowed_roots` defined in configuration. Path traversal attacks are rejected.
  - Deletions are executed strictly via `send2trash` (Recycle Bin only, never permanent), and require explicit user confirmation.

### E. Untrusted Prompt Injection
- **Pattern:** Web search outputs, scraped page text, and file contents were directly concatenated into LLM prompts without boundary delimiters or untrusted data markers.
- **Risk:** Indirect prompt injection could hijack agent intent to trigger tools.
- **Cris Mitigation:**
  - Content from external web pages, emails, and files is wrapped with explicit untrusted data markers.
  - Sensitive operations remain blocked behind the non-bypassable `ConfirmationGate`.

---

## 3. Summary Decision

All reference code was discarded. The Cris agent is built from the ground up with robust security gates, parameter validation, rate limiting, and safe local storage.
