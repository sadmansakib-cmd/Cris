# Cris Agent — Local Voice-Controlled Windows PC Assistant

Cris is a local, voice-controlled Jarvis-style desktop assistant for Windows 10/11. Cris can listen, speak (fluent English and natural Bengali), automate Windows OS workflows, search and fetch web information, manage personal productivity, interact with Google Workspace (Calendar, Gmail, Drive) and GitHub, and autonomously build and deploy software applications from natural language prompts.

---

## 1. Security Architecture & Safety Rules

- **Zero Arbitrary Execution:** Built from scratch with zero copied code from unaudited references. All `shell=True` subprocess calls, `eval()`, `exec()`, and runtime package downloads are strictly banned.
- **Fail-Closed Confirmation Gate:** Before executing any action that deletes or moves files, sends email, commits or pushes code, deploys projects, spends money, installs software, or runs shell commands, Cris states in one sentence what will happen and waits for explicit user confirmation (`yes` / `হ্যাঁ`). If unconfirmed after 30 seconds, the action cancels automatically.
- **Emergency Kill Switch (`Ctrl+Alt+Q`):** A global hotkey immediately aborts all automated mouse/keyboard actions and background pipelines.
- **Strict Directory Boundaries (`allowed_roots`):** File operations are sandboxed to permitted directories configured in `config.py`. Path traversal attacks (`../../`) are blocked.
- **Recycle Bin Deletion Only (`send2trash`):** Deleted files are sent to the Windows Recycle Bin—never permanently destroyed.
- **Untrusted External Data Protection:** Web search snippets, scraped HTML, email bodies, and external tool outputs are tagged as untrusted data and never interpreted as system instructions.
- **Privacy-First Wake Word:** The microphone audio is processed strictly in local RAM by `openWakeWord` ("Hey Cris"). Mic audio is **never** streamed to the cloud until the wake word triggers.

---

## 2. Pinned Dependencies & Justification

Every package in `requirements.txt` has a specific, auditable purpose:

| Package | Pinned Version | Justification |
| :--- | :--- | :--- |
| `google-genai` | `0.1.1` | Official Google GenAI SDK for Gemini API reasoning and Live bidirectional audio streaming. |
| `google-generativeai` | `0.8.3` | Alternative client adapter for Gemini text generation models. |
| `openwakeword` | `0.6.0` | In-memory local wake word detection for phrase "Hey Cris". Zero cloud mic streaming. |
| `faster-whisper` | `1.0.3` | High-performance local speech-to-text (STT) with auto-detection for English and Bengali. |
| `edge-tts` | `6.1.12` | High-quality neural text-to-speech with native support for `bn-BD` and `en-US` voices. |
| `sounddevice` | `0.5.1` | Audio hardware enumeration and raw audio stream capture for microphone and speaker. |
| `numpy` | `1.26.4` | Efficient numerical byte-buffer manipulation for 16-bit 16kHz PCM audio arrays. |
| `pyautogui` | `0.9.54` | Safe keyboard typing and hotkey execution with failsafe boundaries. |
| `keyboard` | `0.13.5` | System-wide global hotkey listener for emergency kill switch (`Ctrl+Alt+Q`). |
| `psutil` | `6.1.0` | Operating system health monitoring (CPU load, memory usage, disk storage, battery). |
| `pillow` | `11.0.0` | Screen grabbing and screenshot manipulation. |
| `send2trash` | `1.8.3` | Native Windows Recycle Bin deletion adapter to prevent irreversible data loss. |
| `duckduckgo-search` | `6.3.7` | Privacy-preserving web search without tracking or requiring external API keys. |
| `playwright` | `1.49.0` | Isolated browser automation in dedicated data directory (never touches personal Chrome profile). |
| `win10toast` | `0.9` | Native Windows 10/11 desktop toast notifications for reminders and timers. |
| `google-api-python-client` | `2.154.0` | Client library for Google Calendar, Gmail, and Drive API calls. |
| `google-auth-httplib2` | `0.2.0` | HTTP transport adapter for Google OAuth2 tokens. |
| `google-auth-oauthlib` | `1.2.1` | Desktop OAuth2 flow for local user authentication. |
| `pytest` | `8.3.3` | Framework for unit tests and safety gate verification. |
| `pytest-mock` | `3.14.0` | Mocking utilities for testing OS tools without side effects. |

---

## 3. Windows Quickstart Guide

### Step 1: Environment Setup
Run the automated PowerShell setup script from the `apps/cris-agent/` directory:
```powershell
cd d:\halt\apps\cris-agent
.\setup.ps1
```
This script will:
1. Detect Python (prefers Python 3.11, works with 3.10+).
2. Create virtual environment `venv\`.
3. Install pinned dependencies from `requirements.txt`.
4. Install Playwright browser binaries.
5. Create runtime folders (`data/`, `tokens/`, `logs/`).
6. Generate `.env` from `.env.example` if not already present.
7. Execute all unit tests to verify baseline integrity.

### Step 2: Configure API Keys
Edit `apps/cris-agent/.env` to configure your keys:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
```

### Step 3: Launch Cris
Run the PowerShell launcher script:
```powershell
# Text chat mode (terminal REPL)
.\run.ps1 --mode text

# Voice pipeline mode (wake word + local whisper + edge-tts)
.\run.ps1 --mode pipeline

# Live realtime audio mode
.\run.ps1 --mode live
```

---

## 4. Built-in Tools Summary

### Computer Tools
- `open_app`: Launches permitted apps from strict allowlist (`notepad.exe`, `calc.exe`, `code.cmd`, etc.).
- `window_manager`: List, focus, minimize, or close open Windows application windows.
- `volume_brightness`: Adjust system volume and monitor brightness.
- `screenshot`: Captures primary screen to `data/screenshots/`.
- `clipboard`: Reads or writes text to Windows clipboard.
- `system_status`: Inspects CPU, RAM, disk space, and battery metrics.
- `keyboard_mouse`: Types text or presses key combinations, checking the `Ctrl+Alt+Q` kill switch.

### File Tools (Sandboxed to `allowed_roots`)
- `file_search`: Pattern search across allowed folders.
- `file_read`: Reads text files safely.
- `file_write`: Writes or appends text to permitted paths.
- `file_copy`: Copies files within allowed boundaries.
- `file_move`: Moves files (requires confirmation).
- `file_delete`: Moves files to Windows Recycle Bin via `send2trash` (requires confirmation).

### Web & Productivity Tools
- `web_search`: DuckDuckGo search returning snippets and links.
- `fetch_page`: Strips HTML and reads clean text under untrusted data boundaries.
- `weather`: Open-Meteo live forecast for any location (no API key required).
- `news`: Top headlines by category or keyword via RSS.
- `notes`: Personal note management in SQLite.
- `reminders`: Schedule reminders with Windows toast notifications.
- `tasks`: Todo task tracking in SQLite.
- `timers`: Countdown timers with chimes and desktop toasts.
- `daily_briefing`: Aggregates reminders, pending tasks, and local weather.
- `browser_automation`: Headless Playwright browser automation in isolated profile `data/browser_profile/`.

### Google & GitHub Integrations
- `google_calendar`: List and schedule calendar events.
- `google_gmail`: Read, search, draft, and send emails (sending requires confirmation).
- `google_drive`: Search and download files into allowed directories.
- `github_ops`: Create repository, commit, push, create PR (mutations require confirmation).

### Workflows
- `app_builder`: Autonomous app builder (`Cris, build me <idea>`):
  1. Generates original specification and UI design brief.
  2. Synthesizes full source code into a new project directory.
  3. Executes verification loop (install, lint, build/test) with up to 3 fix iterations.
  4. Prompts confirmation gate with summary.
  5. Initializes Git, creates GitHub repo, pushes code, and deploys live.
- `deploy_helper`: Deploys static build folders to Cloudflare Pages or Netlify (requires confirmation).

---

## 5. Manual Test Checklist for User

Because audio devices, physical microphones, live OAuth logins, and real PC automation require physical hardware and user credentials, verify the following manually:

| # | Test Case | Action / Prompt | Expected Behavior |
| :--- | :--- | :--- | :--- |
| **1** | **Microphone & Audio** | Run `python -c "from core.audio_devices import list_audio_devices; print(list_audio_devices())"` | Verify input microphone and speaker are listed with valid index numbers. |
| **2** | **Wake Word Gate** | Run `.\run.ps1 --mode pipeline` and say **"Hey Cris"** into mic | Terminal logs wake word detection and speaks *"I'm listening"*. Mic audio is not transmitted until wake word triggers. |
| **3** | **Bangla Speech Routing** | Ask in Bengali: *"আজকের আবহাওয়া কেমন?"* | Cris replies in Bengali with weather details using neural voice `bn-BD-PradeepNeural`. |
| **4** | **English Speech Routing** | Ask in English: *"Give me a daily briefing."* | Cris replies in English using neural voice `en-US-GuyNeural`. |
| **5** | **Confirmation Gate (Reject)** | Run tool to delete or move a file: say *"no"* when prompted | Confirmation gate cancels action immediately (fail-closed). |
| **6** | **Confirmation Gate (Timeout)** | Run tool requiring confirmation: wait 30 seconds without typing | Confirmation gate automatically aborts after 30 seconds. |
| **7** | **Emergency Kill Switch** | Trigger a typing action and immediately press **`Ctrl+Alt+Q`** | Automation halts immediately with *"Emergency abort triggered"* log. |
| **8** | **App-Builder Workflow** | Prompt: *"Cris, build me a pomodoro timer"* | Executes 5-step pipeline, verifies build, asks confirmation, then creates repo and deploys. |
