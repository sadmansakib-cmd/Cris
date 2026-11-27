# Cris Agent Development Progress Tracker

## Phase 1: Foundation, License Scan & Text-only Core
- [x] Step 0: License and safety scan of reference repo (`docs/REFERENCE_REVIEW.md`).
- [x] Zero code copy confirmed (no license in reference); pure original implementation.
- [x] Repository skeleton and directory structure created under `apps/cris-agent/`.
- [x] `.gitignore` updated for Python virtualenvs, caches, local databases, and tokens.
- [x] `config.py` and `core/config_loader.py` with typed configurations, rate limits, and fallback settings.
- [x] `memory/sqlite_store.py` SQLite store for facts, notes, reminders, tasks, and conversation log.
- [x] `core/personality.py` system prompt (calm, concise, dry wit, bilingual Bangla/English).
- [x] `core/llm_provider.py` resilient multi-provider client (Gemini -> Groq -> Ollama) with backoff, jitter, and rate limiting.
- [x] Text-only chat mode in `main.py`.
- [x] Unit tests for Phase 1 (`tests/test_config.py`, `tests/test_memory.py`, `tests/test_personality.py`, `tests/test_llm_provider.py`).

## Phase 2: Confirmation Gate & Safe System Tools
- [x] Non-bypassable `ConfirmationGate` in `core/confirmation_gate.py`.
- [x] Tool registry contract (`TOOL_NAME`, `TOOL_DESC`, `TOOL_PARAMS`, `execute()`) in `tools/registry.py`.
- [x] Safe computer tools: `open_app`, `window_manager`, `volume_brightness`, `screenshot`, `clipboard`, `system_status`, `keyboard_mouse` (with Ctrl+Alt+Q kill switch).
- [x] Safe file tools restricted to `allowed_roots`: `file_search`, `file_read`, `file_write`, `file_move`, `file_copy`, `file_delete` (via `send2trash`).
- [x] Phase 2 unit tests with mock OS calls.

## Phase 3: Voice Pipeline & Live Mode
- [x] Local wake word detection via `openWakeWord` ("Hey Cris").
- [x] Silence detection & configurable session timeout (default 20s).
- [x] Pipeline mode: `openWakeWord` -> `faster-whisper` -> Gemini -> `edge-tts` (Bangla & English voices).
- [x] Live mode: Gemini Live realtime audio API via official `google-genai` SDK.
- [x] Device selection & audio diagnostics (`core/audio_devices.py`).
- [x] Phase 3 tests passing.

## Phase 4: Web, Productivity & Browser Tools
- [x] Web tools: DuckDuckGo `web_search`, `fetch_page` (read-only untrusted text), Open-Meteo `weather`, `news`.
- [x] Productivity tools: `notes`, `reminders` (Windows toast), `tasks`, `timers`, `daily_briefing`.
- [x] Browser automation via Playwright in dedicated isolated profile (`data/browser_profile`).
- [x] Phase 4 tests passing.

## Phase 5: Google Integrations
- [x] Desktop OAuth2 flow storing tokens in `tokens/`.
- [x] Calendar read/create (`integrations/google/calendar_tool.py`).
- [x] Gmail read/search/draft with confirmation gate for sending (`integrations/google/gmail_tool.py`).
- [x] Drive search/download under `allowed_roots` (`integrations/google/drive_tool.py`).
- [x] Phase 5 tests passing.

## Phase 6: GitHub, Deploy Helper & App-Builder Workflow
- [x] GitHub integration (`integrations/github/github_client.py`) with `gh` CLI and REST API fallback.
- [x] Deploy helper for Cloudflare Pages and Netlify (`workflows/deploy_helper.py`) with confirmation gate.
- [x] Complete App-Builder workflow (`workflows/app_builder.py`):
  1. Project spec & original UI brief generation.
  2. Code generation under `allowed_roots`.
  3. Verification loop (install, lint, build/tests with up to 3 fix iterations).
  4. Confirmation gate summary prompt before any remote actions.
  5. Git init, GitHub repo creation, push, and deployment with live URL.
  6. Transparent honest failure reporting.
- [x] Phase 6 tests passing.

## Phase 7: Windows Setup Scripts & Documentation
- [x] `setup.ps1` automated environment and dependency installer.
- [x] `run.ps1` runner script.
- [x] `requirements.txt` with pinned versions and explanations.
- [x] `.env.example` template.
- [x] Detailed `README.md` with manual test checklist.
- [x] Root `README.md` note.

## Cris v1.3: Hardening, Minimal HUD, Web Agent & Autonomous Workflows
- [x] **Part 0: Local Server Hardening**
  - Loopback-only binding (`127.0.0.1`, never `0.0.0.0`).
  - Cryptographically secure per-launch ephemeral token (`secrets.token_urlsafe(32)`).
  - Anti-DNS rebinding (`Host`) and anti-CSRF (`Origin`) header validation. Wildcard CORS blocked.
  - Approval source authentication: approvals accepted ONLY from authenticated UI, voice, or CLI.
  - `docs/SECURITY.md` and `tests/test_server_security.py` passing.
- [x] **Part 1: HUD Minimalist Cleanup**
  - Removed decorative text, version numbers, and filler strings.
  - Subtitle capsule, single status indicator (`idle`/`listening`/`talking`/`working`), minimal input bar.
  - Telemetry (CPU/RAM/battery/model) tucked behind toggleable flyout.
  - Before/after screenshots saved to `docs/ui/before_cleanup.png` and `docs/ui/after_cleanup.png`.
- [x] **Part 2: 11 Slide-Over Glass Module Panels**
  - Slim icon dock on left side.
  - 11 sliding glass panels: Tasks, Approvals, Web Agent, Notes, Files, Google, GitHub, Memory, Skills, Logs, Settings.
  - Keyboard (`Esc`) and voice commands (*"Cris, open tasks"*) support.
- [x] **Part 3: Autonomous Task Runner (OpenClaw-style)**
  - Planner step generates ordered tool DAG using registered tools.
  - Executor loop with hard limits (30 steps, 50 tool calls, 600s wall time, 3 identical failures stuck detection).
  - Persistent SQLite queue: unfinished tasks restore safely as `paused` on restart, never auto-resumed.
  - Workflow recipe engine supporting YAML recipes in `workflows/recipes/*.yaml`.
- [x] **Part 4: Playwright Web Agent**
  - Isolated profile in `data/browser_profile/` (headed default, headless toggle).
  - Domain safety policy in `config/domains.yaml` (banking, localhost, private RFC-1918 IPs blocked).
  - Form safety stops: blocks password, CVV, OTP, and passcode typing -> pauses for human takeover.
  - CAPTCHA safety stops: pauses and asks user to solve challenge.
  - Untrusted data delimiters `[UNTRUSTED_WEB_DATA]` applied to prevent prompt injection.
- [x] **Part 5: Background Tasks & Extensibility**
  - Background scheduler enforcing unattended read-only rule.
  - Mutating tasks pushed to Approvals panel and trigger Windows desktop toast.
  - Declarative skills in `skills/` and draft skills in `skills/pending/` with one-click review/approval.
  - Remote control Telegram bot documented and disabled by default.
- [x] **Part 6: Testing & Verification**
  - 47 automated unit tests passing across 17 test modules in `tests/runner.py`.
  - Code hygiene AST test verifying complete absence of `eval`, `exec`, `shell=True`, and `os.system`.
  - Manual test checklist updated in `README.md`.

