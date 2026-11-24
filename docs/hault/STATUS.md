# HAULT — Engineering Status Report

> **Purpose:** Ground-truth audit of every module, plugin, page, service, model, and integration in the HAULT code base at the close of the Phase 1–16 scaffold.
> **Scope:** Analysis only. No code changes. No new features. No architectural redesign.
> **Verdict up front:** Structurally complete across all 16 phases. Functionally production-ready in **~0%** of modules. Overall real-vs-stub estimate: **~25–30% real code, ~70–75% scaffold/stub/mock**.

Maturity scale used throughout:

| Level | Name              | Meaning                                                                 |
| ----- | ----------------- | ----------------------------------------------------------------------- |
| 0     | Empty             | File(s) exist, no meaningful logic.                                     |
| 1     | Skeleton          | Interfaces + wiring, all behaviour stubbed/mocked.                      |
| 2     | Partial           | Happy path implemented, no auth/validation/errors/tests.                |
| 3     | Functional        | Real logic, basic auth/validation, no hardening, thin/no tests.        |
| 4     | Hardened          | Auth, RBAC, validation, error handling, logs, migrations, basic tests. |
| 5     | Production        | Above + observability, rate limits, backups, secrets mgmt, CI gates.   |
| 6     | Battle-tested     | Above + load-tested, chaos-tested, documented SLOs, on-call runbooks.  |

Priority scale: **P0 Critical** (blocks any prod deploy), **P1 High** (blocks a real user), **P2 Medium** (blocks scale/ops), **P3 Low** (polish/docs).

---

## 0. Executive Summary

| Area                          | Maturity | Completion | Notes                                                                       |
| ----------------------------- | -------- | ---------- | --------------------------------------------------------------------------- |
| Monorepo / build              | 3        | 60%        | pnpm + turbo wired, no CI gates enforced, no prod Dockerfiles verified.     |
| Core API (NestJS)             | 2        | 40%        | Modules exist, most services return stubs or read/write minimal Prisma.     |
| Auth (JWT + WebAuthn + OAuth) | 2        | 35%        | Password + JWT works; WebAuthn/OAuth controllers are scaffolds.             |
| Permissions engine            | 2        | 40%        | Grant model + gateway exist; enforcement decorator rarely applied.          |
| Plugin sandbox                | 1        | 25%        | Worker-thread bridge only; no CPU/mem limits, no WASM, no signature verify.|
| Marketplace                   | 1        | 20%        | REST surface + trusted-key store stub; no real signing / registry.          |
| AI engine + RAG               | 1        | 25%        | Hash embeddings + in-memory store; no real provider streaming path.         |
| Media (STT/TTS/OCR)           | 1        | 20%        | Interfaces + one provider each, no queueing, no storage integration.        |
| Web app                       | 2        | 45%        | 20 pages render; most call stubbed endpoints or local state.                |
| Desktop (Tauri) / Mobile      | 1        | 15%        | Shells compile-ready; almost no native features wired.                      |
| Deployment                    | 1        | 20%        | docker-compose files exist; no TLS, no bootstrap, no backup cron.           |
| Security posture              | 1        | 20%        | Crypto module exists; no threat model executed, no scan in CI.              |
| Tests                         | 0        | 0%         | No unit, integration, or e2e tests present.                                 |
| Docs                          | 4        | 80%        | Architecture + phase docs strong; ops/runbooks/API reference missing.       |

**Overall production-readiness: ~25%.** Everything below expands on this.

---

## 1. Infrastructure & Repo

### 1.1 Monorepo & tooling
- **Files:** `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.prettierrc`.
- **Maturity:** 3 · **Completion:** 60%
- **Status:** Workspace resolves; turbo pipeline defined.
- **Blockers:** No `lint`, `typecheck`, `test`, `build` gates verified in CI; no `engines` pinning; no Renovate/Dependabot.
- **Effort:** S · **Priority:** P1

### 1.2 CI/CD
- **Files:** `.github/workflows/ci.yml`, `.github/workflows/docker.yml`.
- **Maturity:** 1 · **Completion:** 20%
- **Blockers:** Workflows are scaffolds; no test job, no image publish auth, no cache, no SAST, no SBOM.
- **Effort:** M · **Priority:** P1

### 1.3 Docker / compose
- **Files:** `docker-compose.yml`, `docker-compose.prod.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker/nginx/conf.d/hault.conf`.
- **Maturity:** 1 · **Completion:** 25%
- **Blockers:** No multi-stage prod verification, no non-root users confirmed, no healthchecks, no Caddy/TLS, no volume backup, no resource limits.
- **Env:** `POSTGRES_*`, `REDIS_URL`, `APP_URL`, TLS cert paths.
- **Effort:** M · **Priority:** P0

### 1.4 Env & config
- **Files:** `.env.example`, `apps/api/src/core/config/env.schema.ts`.
- **Maturity:** 3 · **Completion:** 65%
- **Status:** Zod schema validates env at boot — good.
- **Blockers:** No secrets-manager integration (KMS/Vault), `ENCRYPTION_KEY` rotation path undocumented.
- **Effort:** M · **Priority:** P1

---

## 2. Database (Prisma / Postgres)

- **Files:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/api/src/core/prisma/prisma.module.ts`.
- **Maturity:** 2 · **Completion:** 45%
- **Status:** Schema covers User/Session/Credential/OAuth/Permission/Audit/Notification/Plugin/Chat.
- **Blockers:**
  - **No migrations folder** — schema drift will be silent. `prisma migrate dev` never run.
  - Missing models for: automations runs, files/media metadata, RAG document registry, marketplace publisher keys, refresh-token family (rotation), rate-limit buckets, backup metadata.
  - No composite indexes for hot queries (`auditLog(userId, createdAt)`, `chatMessage(threadId, createdAt)` present? verify).
  - No row-level tenancy (single-tenant assumption baked in).
  - `Bytes` fields for encrypted blobs — key ID column missing (breaks rotation).
- **Security:** PII in `User` unencrypted at rest apart from tokens; no column-level encryption for `email`/`displayName` (may be acceptable — decide).
- **Effort:** L · **Priority:** P0

---

## 3. Core API modules (`apps/api/src/core`)

### 3.1 Auth (`auth/`)
- **Files:** `auth.controller.ts`, `auth.service.ts`, `jwt.strategy.ts`, `jwt-auth.guard.ts`, `totp.service.ts`, `oauth.controller.ts`, `webauthn.controller.ts`, `current-user.decorator.ts`.
- **Maturity:** 2 · **Completion:** 35%
- **Blockers:**
  - Refresh-token rotation + reuse detection not implemented.
  - `oauth.controller.ts` — no real provider flows (state, PKCE, callback verification).
  - `webauthn.controller.ts` — attestation/assertion verification stubbed.
  - No rate-limit on `/auth/login`, `/auth/register`, `/auth/totp`.
  - No account-lockout / breached-password check.
  - No email-verification flow (schema has `emailVerifiedAt`, no sender wiring).
  - No password reset flow.
  - `mustChangePassword` never enforced by any guard.
- **Env:** `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, OAuth client IDs/secrets (per provider), `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`.
- **Effort:** L · **Priority:** P0

### 3.2 Users (`users/`)
- **Maturity:** 2 · **Completion:** 45%
- **Blockers:** No admin CRUD endpoints for user lifecycle (suspend/delete/impersonate audit). No GDPR export/delete. No profile update validation.
- **Effort:** M · **Priority:** P1

### 3.3 Crypto (`crypto/`)
- **Maturity:** 3 · **Completion:** 60%
- **Blockers:** Single symmetric key from env; no envelope encryption, no KMS, no key-ID stored alongside ciphertext, no rotation script. AAD not consistently applied.
- **Effort:** M · **Priority:** P1

### 3.4 Permissions (`permissions/`)
- **Files:** `permissions.engine.ts`, `permissions.controller.ts`, `permissions.gateway.ts`, `requires-permission.decorator.ts`, `permissions.module.ts`.
- **Maturity:** 2 · **Completion:** 40%
- **Blockers:**
  - `@RequiresPermission()` decorator applied on almost **no** controllers — every plugin-invoked action currently bypasses the engine.
  - Grant scope matching is glob-only; no path traversal / regex safety tests.
  - Gateway pushes prompts, but there is no persistent request queue for offline decisions.
  - No admin UI showing global grant matrix.
- **Effort:** L · **Priority:** P0

### 3.5 Audit (`audit/`)
- **Maturity:** 3 · **Completion:** 55%
- **Blockers:** Not called from most services. No append-only guarantee (no signature chain). No retention/rotation. No export.
- **Effort:** M · **Priority:** P1

### 3.6 Plugins runtime (`plugins/`)
- **Files:** `plugins.controller.ts`, `plugins.service.ts`, `plugin-runtime.service.ts`, `sandbox/plugin-sandbox.ts`, `sandbox/plugin-worker.js`.
- **Maturity:** 1 · **Completion:** 25%
- **Blockers:**
  - Worker-thread sandbox has **no CPU/memory limits** enforced.
  - No syscall allow-list; plugin code can `require()` anything in the worker.
  - No manifest signature verification on load.
  - Runtime host bridge does not check permissions before satisfying capability calls.
  - No lifecycle management: install/enable/disable/uninstall persistence incomplete.
  - No plugin telemetry (invocations, errors, latency).
- **Effort:** XL · **Priority:** P0

### 3.7 Marketplace (`plugins/marketplace/`)
- **Maturity:** 1 · **Completion:** 20%
- **Blockers:** In-memory registry, no HTTPS registry, no Ed25519 verification against publisher keys, no version pinning, no rollback, no CVE feed.
- **Effort:** L · **Priority:** P2

### 3.8 AI engine (`ai/`)
- **Files:** `ai.engine.ts`, `ai.service.ts`, `ai-engine.controller.ts`, `ai.controller.ts`, `rag.service.ts`, `memory-vector.store.ts`, `eval.service.ts`.
- **Maturity:** 1 · **Completion:** 25%
- **Blockers:**
  - `complete()` synchronous only — no streaming SSE endpoint.
  - No tool-calling execution loop wired to permissions.
  - RAG uses in-memory store + hash embeddings; no pgvector/Qdrant, no re-index job.
  - No cost accounting per user/model.
  - No safety layer (prompt-injection filter, output moderation).
- **Env:** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_BASE_URL`.
- **Effort:** XL · **Priority:** P1

### 3.9 Media (`media/`)
- **Maturity:** 1 · **Completion:** 20%
- **Blockers:** No job queue for STT/OCR; synchronous HTTP will timeout. No storage-provider handoff, no signed URLs, no MIME sniffing, no antivirus.
- **Env:** provider API keys, `S3_*`.
- **Effort:** L · **Priority:** P2

### 3.10 Notifications (`notifications/`)
- **Maturity:** 2 · **Completion:** 40%
- **Blockers:** In-app only, no email/push dispatcher, no per-user prefs UI, no digest job.
- **Effort:** M · **Priority:** P2

### 3.11 Settings (`settings/`)
- **Maturity:** 2 · **Completion:** 40%
- **Blockers:** Free-form KV; no schema-validated setting definitions, no admin overrides, no audit on change.
- **Effort:** S · **Priority:** P2

### 3.12 Admin (`admin/`)
- **Maturity:** 2 · **Completion:** 45%
- **Blockers:** `JwtAuthGuard` only — **no admin RBAC** (any logged-in user hits `/admin/*`). No pagination, no filters beyond basics, no CSV export, no data-retention controls, `backup/snapshot` is a stub.
- **Effort:** M · **Priority:** P0

### 3.13 Health (`health/`)
- **Maturity:** 2 · **Completion:** 50%
- **Blockers:** Liveness only; no readiness that checks DB/Redis/queue, no `/metrics` (Prometheus).
- **Effort:** S · **Priority:** P1

### 3.14 Common (`common/`)
- **Maturity:** 3 · **Completion:** 60%
- **Status:** Zod pipe + global exception filter exist.
- **Blockers:** No request-id middleware, no structured logger config (pino), no correlation ID propagation to plugins.
- **Effort:** S · **Priority:** P1

---

## 4. Providers (`apps/api/src/core/providers`)

| Provider           | Files                                                                | Maturity | Completion | Blockers                                                        |
| ------------------ | -------------------------------------------------------------------- | -------- | ---------- | --------------------------------------------------------------- |
| AI OpenAI          | `ai/openai.provider.ts`                                              | 2        | 40%        | No streaming, no retry/backoff, no token accounting.            |
| AI Anthropic       | `ai/anthropic.provider.ts`                                           | 1        | 25%        | Skeleton; missing tool-use mapping.                             |
| Storage local      | `storage/local.provider.ts`                                          | 3        | 60%        | Path traversal check needed, no quota, no cleanup job.          |
| Storage S3         | `storage/s3.storage.ts`                                              | 2        | 40%        | No multipart, no signed URLs helper, no lifecycle rules.        |
| Email SMTP         | `email/smtp.provider.ts`                                             | 2        | 45%        | No template registry, no bounce handling, no DKIM guidance.     |
| Media OpenAI audio | `media/openai-audio.provider.ts`                                     | 1        | 30%        | No streaming STT, no format normalisation.                      |
| Media AI vision    | `media/ai-vision.provider.ts`                                        | 1        | 25%        | Stub only.                                                      |
| OCR Tesseract      | `media/tesseract-ocr.provider.ts`                                    | 1        | 30%        | Runs in-process — should be worker/queue.                       |

**Effort (aggregate):** L · **Priority:** P1

---

## 5. Plugins (55 total, `plugins/*`)

All plugins share the same shape: manifest + `src/index.ts` + README. None currently execute inside a real sandbox with permission enforcement. Grouped by risk/completion tier.

### 5.1 Tier A — pretend to work end-to-end (need real APIs)
`gmail`, `outlook`, `discord`, `slack`, `telegram`, `whatsapp`, `sms-twilio`, `github`, `docker`, `search`, `scraper`, `browser`, `computer-control`, `terminal`.
- **Maturity:** 1 · **Completion:** 15–25%
- **Common blockers:** OAuth flows unstitched, secrets read via unimplemented `ctx.secret`, no rate-limits, no error retry, browser plugin ships without Playwright install verification, computer-control lacks per-verb permission gate, terminal has no PTY session store.
- **Priority:** P0 for `computer-control`, `terminal`, `browser` (danger high); P1 for comms; P2 for the rest.

### 5.2 Tier B — stateful CRUD (need real persistence tables)
`tasks`, `notes`, `notes-prod`, `calendar`, `kanban`, `bookmarks`, `contacts`, `folders`, `files`, `downloads`, `pomodoro`, `habits`, `goals`, `finance`, `health`, `whiteboard`, `tabs`, `clipboard`, `zip`, `screenshot`, `citations`, `knowledge-graph`, `code-editor`, `code-docs`, `api-testing`, `academic-search`, `lit-review`, `paper-summarizer`, `research-mode`, `reading-mode`, `summaries`, `ai-chat`, `ai-coding`, `ai-qa`, `bug-perf`, `autofill`, `cookie-manager`, `ocr`, `automations`, `voice-trigger`, `admin`, `backup`.
- **Maturity:** 1 · **Completion:** 15–30%
- **Common blockers:** Use `ctx.kv` in memory; no dedicated Prisma models; no schemas; no list/filter/paginate; no import/export; no per-user isolation tests.
- **Priority:** P1 for `tasks/notes/calendar/files/kanban` (core UX); P2 for the rest.

### 5.3 Cross-cutting plugin blockers
- No plugin **signature verification** on install.
- No plugin **secret-scoped storage** with encryption.
- No plugin **UI iframe isolation** (currently rendered directly in the shell — XSS/exfil risk).
- No plugin **update/uninstall migration** hooks.
- No plugin **test harness**.

**Effort:** XL aggregated · **Priority:** P0 for the sandbox/permission plumbing that all plugins depend on.

---

## 6. Web app (`apps/web`)

| Page                | Backend wired?           | Maturity | Completion | Blockers                                                        |
| ------------------- | ------------------------ | -------- | ---------- | --------------------------------------------------------------- |
| Login               | Partial (`/auth/login`)  | 2        | 50%        | No OAuth buttons wired, no MFA challenge UI, no error surfacing.|
| Dashboard           | Mocked                   | 1        | 30%        | Widgets read local stubs.                                       |
| AppShell            | —                        | 3        | 65%        | Sidebar hardcoded; should be permission/role-driven.            |
| Plugins             | Partial                  | 2        | 40%        | Install button not wired to real registry; no danger badges.    |
| Permissions         | Partial                  | 2        | 45%        | No revoke confirm, no grant matrix export.                      |
| Marketplace         | Stubbed                  | 1        | 25%        | Search + install call unimplemented registry.                   |
| AiChat / AiEngine   | Partial                  | 2        | 40%        | No SSE stream; renders whole reply.                             |
| BrowserPage         | Stubbed                  | 1        | 25%        | Actions do not persist sessions.                                |
| Communications      | Stubbed                  | 1        | 20%        | Provider selectors non-functional.                              |
| Research            | Stubbed                  | 1        | 25%        | Citation list mock data.                                        |
| Coding              | Stubbed                  | 1        | 20%        | Editor/terminal not connected to backend.                       |
| Productivity        | Stubbed                  | 1        | 25%        | Local state only.                                               |
| Knowledge           | Stubbed                  | 1        | 25%        | No file upload path to storage.                                 |
| Life                | Stubbed                  | 1        | 25%        | Health/finance charts on fake data.                             |
| Automations         | Stubbed                  | 1        | 25%        | Trigger form saves nowhere.                                     |
| VoiceVision         | Stubbed                  | 1        | 25%        | Recorder starts but no upload to media API.                     |
| ComputerControl     | Stubbed                  | 1        | 25%        | Buttons wired to non-existent commands.                         |
| Admin               | Partial                  | 2        | 45%        | Consumes `/admin/*` (which is itself partial); no auth gate.    |
| Settings            | Partial                  | 2        | 40%        | Writes settings without validation.                             |

**Cross-cutting web blockers:**
- No React Router route guards for admin.
- No global error boundary + toast strategy.
- No API client retry / auth-refresh interceptor.
- No i18n, no a11y pass, no responsive audit.
- No CSP headers set at nginx layer.
- No web tests (RTL / Playwright).

**Effort:** L · **Priority:** P1

---

## 7. Desktop (`apps/desktop`, Tauri v2)

- **Maturity:** 1 · **Completion:** 15%
- **Blockers:** Only `native_info` and `screen_capture` commands; no auto-updater, no code signing, no notarisation, no OS keychain integration, no deep-link auth callback, no capability audit.
- **Env:** signing certs (macOS/Windows), updater key pair.
- **Effort:** L · **Priority:** P2

## 8. Mobile (`apps/mobile`, Expo)

- **Maturity:** 1 · **Completion:** 15%
- **Blockers:** WebView shell only; no native camera/mic/notification bridges hooked to `__HAULT_MOBILE__.invoke`, no EAS build config, no OTA update channel.
- **Effort:** L · **Priority:** P3

---

## 9. Shared packages

- `packages/shared` — Zod schemas for permissions/plugin manifests. **Maturity 3 / 65%.** Missing shared error types, DTOs for admin endpoints. **Effort S / P2.**
- `packages/sdk` — Plugin SDK skeleton (`PluginContext`, `PluginHost`, `PluginScheduler`, `PluginEvents`). **Maturity 1 / 30%.** No versioning story, no typing for capabilities returned by host, no `ctx.secret`, no `ctx.audit`, no test doubles. **Effort L / P0** (every plugin depends on this).

---

## 10. Security posture (cross-cutting)

| Concern                                | Status                                                                |
| -------------------------------------- | --------------------------------------------------------------------- |
| Threat model                           | Not written.                                                          |
| Auth rate-limit / lockout              | Missing.                                                              |
| CSRF                                   | Not applicable to pure Bearer API, but web CSP/COOP/COEP missing.     |
| Secret storage                         | Single env key, no KMS, no rotation.                                  |
| Plugin isolation                       | Worker thread only, no resource caps, no syscall filter.              |
| RBAC on admin                          | Missing (JWT-only).                                                   |
| Permission enforcement on capabilities | Decorator exists, rarely applied.                                     |
| Audit log integrity                    | No signing chain.                                                     |
| Dependency scanning                    | Not in CI.                                                            |
| SBOM                                   | Not generated.                                                        |
| Backups                                | No automated snapshots.                                               |
| Disaster recovery                      | No documented RTO/RPO.                                                |

**Priority:** P0 aggregate.

---

## 11. Observability

- No structured logger config (pino) applied everywhere.
- No metrics endpoint (`/metrics`).
- No traces (OpenTelemetry).
- No log shipper.
- No uptime probe.
- No alerting.

**Effort:** M · **Priority:** P1

---

## 12. Testing

- **Unit:** none.
- **Integration:** none.
- **E2E (web):** none.
- **Plugin harness:** none.
- **Load/perf:** none.

**Effort:** L (bootstrap) then continuous · **Priority:** P0 for auth/permissions/sandbox first.

---

## 13. Documentation

- Architecture docs (`docs/hault/01`–`24`) — strong.
- Missing: API reference (OpenAPI), operator runbook, on-call playbook, plugin authoring guide, security policy, contribution guide, ADRs, changelog.

**Effort:** M · **Priority:** P2

---

## 14. Aggregated production blockers (must clear before any prod deploy)

1. Prisma migrations checked in and applied (Section 2).
2. Refresh-token rotation + rate-limits on auth (Section 3.1).
3. Admin RBAC guard on `/admin/*` and admin pages (Section 3.12, Section 6).
4. Permission decorator applied to every capability endpoint (Section 3.4).
5. Plugin sandbox: CPU/mem caps, signature verify, host-bridge permission check (Section 3.6).
6. Structured logging + request IDs + readiness probe (Section 3.13, 3.14, Section 11).
7. TLS + reverse proxy + healthcheck + backup cron in compose prod (Section 1.3).
8. Secrets: KMS-ready `KeyProvider` interface + key-ID column (Section 3.3, Section 2).
9. First test suite covering auth + permissions + sandbox (Section 12).
10. CI gates enforcing typecheck/lint/test/build/scan (Section 1.2).

---

## 15. Environment variables inventory (required to run for real)

Beyond the current `.env.example`:

- `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
- `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`
- `RESEND_API_KEY` (or SMTP creds already listed)
- `PLUGIN_TRUSTED_KEYS` (path to JSON of publisher Ed25519 pubkeys)
- `RATE_LIMIT_REDIS_PREFIX`
- `LOG_LEVEL`, `LOG_FORMAT`
- `OTEL_EXPORTER_OTLP_ENDPOINT` (when tracing added)
- `BACKUP_S3_BUCKET`, `BACKUP_SCHEDULE_CRON`

## 16. External services required

- Postgres 15+
- Redis 7+
- SMTP or Resend for transactional email
- S3-compatible object store (for media + backups)
- OAuth apps: Google, GitHub (per provider used)
- AI provider(s): OpenAI/Anthropic/Gemini (as configured)
- Optional: Playwright browsers image, Tesseract OCR runtime image, pgvector (when RAG upgraded), OpenTelemetry collector, log/metrics backend.

---

---

## Sprint 2.1 — Infrastructure Completion (delta)

Completed in this sprint (infra-only, no feature/architecture changes):

- **DB init from scratch** — baseline Prisma migration + `migration_lock.toml`
  added under `apps/api/prisma/migrations/20260722000000_init/`.
- **Centralised request/response contract** — `RequestIdMiddleware`,
  `ResponseTransformInterceptor`, and a rewritten `AllExceptionsFilter`
  give every route a `{ success, data|error, meta:{ requestId, timestamp, path } }`
  envelope plus `x-request-id` header.
- **Config-driven infra** — `ThrottlerModule` bound to `RATE_LIMIT_TTL_MS` /
  `RATE_LIMIT_MAX`; `TRUST_PROXY`, `APP_VERSION`, `ENABLE_SWAGGER`, `API_URL`
  added to `env.schema.ts`. Every value read in `main.ts` is env-driven.
- **CORS** — `APP_URL` parsed as a comma-separated allow-list, credentials
  on, `x-request-id` exposed.
- **Swagger** — `/docs` (UI) + `/docs-json` (spec) via `@nestjs/swagger`,
  gated by `ENABLE_SWAGGER`, Bearer + cookie auth schemes declared.
- **Health checks** — `/health` and `/health/ready` (already existed) are
  now formally excluded from the `/api` prefix and Swagger scope.
- **`.env.example`** rewritten as the canonical reference — every variable
  the code actually reads is documented, grouped, and defaulted.

See `docs/hault/infra-completion-report.md` for the full report and the
remaining-blockers list (B1–B8). Sprint stopped as instructed; no
auto-continuation.
