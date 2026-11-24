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
- [ ] Non-bypassable `ConfirmationGate` in `core/confirmation_gate.py`.
- [ ] Tool registry contract (`TOOL_NAME`, `TOOL_DESC`, `TOOL_PARAMS`, `execute()`).
- [ ] Safe computer tools: `open_app`, `window_manager`, `volume_brightness`, `screenshot`, `clipboard`, `system_status`, `keyboard_mouse` (with Ctrl+Alt+Q kill switch).
- [ ] Safe file tools restricted to `allowed_roots`: `file_search`, `file_read`, `file_write`, `file_move`, `file_copy`, `file_delete` (via `send2trash`).
- [ ] Phase 2 unit tests with mock OS calls.

## Phase 3: Voice Pipeline & Live Mode
- [ ] Local wake word detection via `openWakeWord` ("Hey Cris").
- [ ] Silence detection & configurable session timeout (default 20s).
- [ ] Pipeline mode: `openWakeWord` -> `faster-whisper` -> Gemini -> `edge-tts` (Bangla & English voices).
- [ ] Live mode: Gemini Live realtime audio API via official `google-genai` SDK.
- [ ] Device selection & audio diagnostics.

## Phase 4: Web, Productivity & Browser Tools
- [ ] Web tools: DuckDuckGo `web_search`, `fetch_page` (read-only untrusted text), Open-Meteo `weather`, `news`.
- [ ] Productivity tools: `notes`, `reminders` (Windows toast), `tasks`, `timers`, `daily_briefing`.
- [ ] Browser automation via Playwright in dedicated isolated profile.
- [ ] Phase 4 tests.

## Phase 5: Google Integrations
- [ ] Desktop OAuth2 flow storing tokens in `tokens/`.
- [ ] Calendar read/create.
- [ ] Gmail read/search/draft (send gated by confirmation).
- [ ] Drive search/download under `allowed_roots`.
- [ ] Phase 5 tests with mocks.

## Phase 6: GitHub, Deploy Helper & App-Builder Workflow
- [ ] GitHub integration (`gh` CLI wrapper with token fallback).
- [ ] Deploy helper for Cloudflare Pages and Netlify (confirmation gated).
- [ ] Complete App-Builder workflow:
  1. Project spec & UI brief generation (original designs).
  2. Code generation under `allowed_roots`.
  3. Verification loop (install, lint, test/build with up to 3 fix iterations).
  4. Confirmation gate summary prompt.
  5. Git init, GitHub repo creation, push, and deployment with live URL.
- [ ] Phase 6 tests.

## Phase 7: Windows Setup Scripts & Documentation
- [ ] `setup.ps1` automated environment and dependency installer.
- [ ] `run.ps1` runner script.
- [ ] `requirements.txt` with pinned versions and explanations.
- [ ] `.env.example` template.
- [ ] Detailed `README.md` with manual test checklist.
- [ ] Root `README.md` note.
