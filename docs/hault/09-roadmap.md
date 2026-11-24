# 09 — Roadmap

Each milestone is independently shippable. Phase 1 is the only prerequisite for everything else.

## Milestone 0 — Scaffold (after docs approved)

- pnpm+turbo monorepo, ESLint/Prettier, tsconfigs, Dockerfiles, compose files, GitHub Actions, `.env.example`, `packages/sdk` skeleton.

## Phase 1 — Core (first build after scaffold)

- Auth: email+password (Argon2id), email verification, password reset, TOTP 2FA, WebAuthn passkeys, OAuth adapter (Google + GitHub reference impls).
- Users, sessions, admin flag.
- Permission Engine + guards + audit log + prompts over WS.
- Settings (system + user, namespaced).
- Notifications (in-app + email hook).
- Plugin Runtime (install/enable/disable/uninstall, manifest validation, first-party loader).
- Provider Registry with `local` storage + `smtp` email + one AI provider stub selectable by env.
- Web shell: login, register, MFA, dashboard, sidebar, theme engine (light/dark/system + custom tokens), settings, plugin manager UI, permission prompt UI, notifications.

## Phase 2 — Computer Control

Files, Folders, Search, Clipboard, OCR, Screenshot, Downloads, Zip, Backup — each as its own plugin.

## Phase 3 — Browser Automation

Headless browser plugin (Playwright), tabs, bookmarks, reading mode, research mode, YT/website summaries, autofill, cookie manager, voice trigger.

## Phase 4 — Communication

Gmail, Outlook, Telegram, WhatsApp Business, Discord (where APIs officially allow), SMS via Twilio-compatible interface, contacts.

## Phase 5 — Research Workshop

Academic search, citation manager, paper summarizer, literature review, knowledge graph, notes, AI Q&A.

## Phase 6 — Coding Workshop

GitHub, code editor, AI coding, docs, terminal, Docker, API testing, bug/perf.

## Phase 7 — Productivity

Tasks, calendar, kanban, notes, whiteboard, habits, goals, pomodoro.

## Phase 8 — AI Engine (full)

Multi-provider orchestration, tools, function-calling, memory, RAG, evaluation harness. (Basic AI ships as a Phase 1 plugin; this is the full engine.)

## Phase 9 — Health / Phase 10 — Finance / Phase 11 — Automation Engine

Same pattern: independent plugin bundles.

## Phase 12 — Voice / Phase 13 — Vision

Provider interfaces for STT/TTS/Wake-word and OCR/Detection; local (whisper.cpp, tesseract) + cloud impls.

## Phase 14 — Plugin Marketplace

Static registry, signed manifests, install-from-URL, ratings, plugin sandbox hardening.

## Phase 15 — Admin

Logs viewer, analytics, error inbox, API usage, security dashboard, device sessions, backup control.

## Phase 16 — Desktop (Tauri) & Mobile (Expo)

Reuse `apps/web` UI, add native shells; permission prompts route through the same engine.

---

**Next step:** review these docs. When approved, I execute Milestone 0 (scaffold), then Phase 1.
