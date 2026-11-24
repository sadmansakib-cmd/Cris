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
- [ ] `setup.ps1` automated environment and dependency installer.
- [ ] `run.ps1` runner script.
- [ ] `requirements.txt` with pinned versions and explanations.
- [ ] `.env.example` template.
- [ ] Detailed `README.md` with manual test checklist.
- [ ] Root `README.md` note.
