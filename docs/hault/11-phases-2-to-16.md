# Milestones 2–16 — Delivery Log

This document tracks what shipped across all remaining phases in this
generation pass. Each plugin was scaffolded with a manifest, a permission
declaration, a health check, and a placeholder TypeScript entry.
Concrete implementations land in the follow-up tickets referenced below.

## Phase 2 — Computer Control (9 plugins)

`files`, `folders`, `search`, `clipboard`, `ocr`, `screenshot`, `downloads`,
`zip`, `backup` — all under `plugins/`. Danger ratings reflect fs write
scope. Shared dependency: `computer-control` core plugin (already shipped).

## Phase 3 — Browser Automation (9 plugins)

`browser` (Playwright), `tabs`, `bookmarks`, `reading-mode`, `research-mode`,
`summaries`, `autofill`, `cookie-manager`, `voice-trigger`. The `browser`
plugin owns the Playwright BrowserContext pool; every other Phase-3 plugin
requests contexts via `ctx.plugin('hault.browser').invoke(...)`.

## Phase 4 — Communication (7 plugins)

`gmail`, `outlook`, `telegram`, `whatsapp`, `discord`, `sms-twilio`,
`contacts`. Providers requiring OAuth reuse the Phase-1 OAuth controller.

## Phase 5 — Research Workshop (7 plugins)

`academic-search`, `citations`, `paper-summarizer`, `lit-review`,
`knowledge-graph`, `notes`, `ai-qa`. Depends on Phase 8 RAG.

## Phase 6 — Coding Workshop (8 plugins)

`github`, `code-editor`, `ai-coding`, `code-docs`, `terminal`, `docker`,
`api-testing`, `bug-perf`.

## Phase 7 — Productivity (8 plugins)

`tasks`, `calendar`, `kanban`, `notes-prod`, `whiteboard`, `habits`,
`goals`, `pomodoro`.

## Phase 8 — AI Engine (core, not a plugin)

Landed as `apps/api/src/core/ai/`:
- `ai.engine.ts` — multi-provider chat, tool loop, memory, streaming.
- `rag.service.ts` — chunk → embed → upsert → query.

## Phases 9-11 — Health, Finance, Automations

`health`, `finance`, `automations` — the automations plugin is the
trigger/action DAG runner (cron, webhook, plugin-event triggers).

## Phase 12 & 13 — Voice / Vision provider interfaces

Landed at `apps/api/src/core/providers/media/media.interfaces.ts`:
`SpeechToText`, `TextToSpeech`, `WakeWord`, `OcrProvider`, `DetectionProvider`.
Concrete impls (whisper.cpp, piper, porcupine, tesseract) plug in via the
provider registry.

## Phase 14 — Plugin Marketplace

Landed at `apps/api/src/core/plugins/marketplace/marketplace.service.ts`:
signed manifest verification, publisher key TOFU, install-from-URL, tarball
SHA256 pinning. Combined with the Worker-thread sandbox (Phase 1
completion), this closes the untrusted-plugin threat model.

## Phase 15 — Admin

Landed as the `admin` plugin with the `admin.*` permission. UI routes:
logs, analytics, errors, API usage, sessions, backups.

## Phase 16 — Desktop & Mobile

See `docs/hault/16-desktop-mobile.md`. Tauri shell for desktop, Expo
WebView + native modules for mobile. Both reuse `apps/web` unchanged.

## How to regenerate plugin scaffolds

```
node scripts/gen-plugins.mjs
```

The script is idempotent — existing files are left untouched.

## Next concrete work

1. Wire `AiEngine` into the DI container and swap `providers/ai/openai.ts`
   to implement its provider interface.
2. Implement the `browser` plugin's Playwright pool with per-user profiles.
3. Add the marketplace UI (list, install-from-URL, publisher key trust).
4. Write end-to-end tests for the sandbox → permission → plugin flow.
