# HAULT — Production Hardening Roadmap

> Companion to `STATUS.md`. Sequenced to **preserve the existing architecture** and minimise feature refactoring. No new phases, no redesign — only turning the current scaffold into a production-grade system.
>
> Ordering rule: everything downstream of a foundational concern is held until that concern is stable. Auth is hardened before the surfaces that depend on it. The sandbox is hardened before plugins that run inside it. Persistence lands before features that need it.
>
> Estimates use T-shirt sizes (**S** ≤ 2d, **M** 3–5d, **L** 1–2w, **XL** 2–4w) for one senior engineer.

---

## Wave 0 — Ground truth (Week 0)

Purpose: freeze the surface, guarantee reproducibility, unblock everything else.

| # | Task                                                                                       | Size | Priority | Depends on |
| - | ------------------------------------------------------------------------------------------ | ---- | -------- | ---------- |
| 0.1 | Snapshot repo, tag `v0.16-scaffold`. Establish `main` protection + PR-required.           | S    | P0       | —          |
| 0.2 | Turn on CI gates: typecheck, lint, build, `pnpm audit`.                                    | S    | P0       | 0.1        |
| 0.3 | Add pino logger + request-id middleware + AsyncLocalStorage correlation.                   | S    | P0       | —          |
| 0.4 | Add `/health/live` + `/health/ready` (checks DB, Redis).                                   | S    | P0       | 0.3        |
| 0.5 | Prisma: generate initial migration from current schema, commit `prisma/migrations/`.       | S    | P0       | —          |

Exit criteria: any commit produces a green pipeline; every request has a correlation ID; readiness returns 503 when DB/Redis are down.

---

## Wave 1 — Security & identity foundations (Weeks 1–3)

Everything below Wave 1 assumes an authenticated user with a real permission check. Nothing else should be hardened before this wave is done.

| # | Task                                                                                              | Size | Priority | Depends on |
| - | ------------------------------------------------------------------------------------------------- | ---- | -------- | ---------- |
| 1.1 | Refresh-token rotation with reuse detection; new `RefreshTokenFamily` table + migration.         | M    | P0       | 0.5        |
| 1.2 | Rate-limit `/auth/*` (Redis token bucket); lockout after N failures; audit each attempt.         | S    | P0       | 0.3        |
| 1.3 | Password reset + email-verify flows (uses SMTP provider already present).                        | M    | P0       | 1.1        |
| 1.4 | Complete WebAuthn attestation + assertion verification (using `@simplewebauthn/server`).          | M    | P1       | 1.1        |
| 1.5 | Complete Google + GitHub OAuth (state, PKCE, callback, token encryption).                        | M    | P1       | 1.1        |
| 1.6 | `KeyProvider` interface + env-backed impl + key-ID column on every encrypted `Bytes` field.      | M    | P0       | 0.5        |
| 1.7 | Rotation script `pnpm crypto:rotate` (re-encrypts under new key-ID).                             | S    | P1       | 1.6        |
| 1.8 | Admin RBAC: `isAdmin` guard applied on `AdminController` + admin pages route guard.              | S    | P0       | —          |
| 1.9 | Audit log signing chain (prev-hash) + retention policy.                                          | M    | P1       | 1.6        |

Exit criteria: attacker cannot brute-force login; refresh reuse invalidates the whole family; only `isAdmin` users can reach `/admin/*`; keys can be rotated without downtime.

---

## Wave 2 — Permission engine & sandbox (Weeks 3–6)

The sandbox and permission engine are the two irreplaceable pieces of HAULT’s security model. Nothing plugin-related ships before this wave.

| # | Task                                                                                                        | Size | Priority | Depends on |
| - | ----------------------------------------------------------------------------------------------------------- | ---- | -------- | ---------- |
| 2.1 | Apply `@RequiresPermission()` to every host-bridge capability in `plugin-runtime.service.ts`.               | M    | P0       | 1.8        |
| 2.2 | Enforce grant checks inside the host bridge (deny-by-default, audit every allow/deny).                      | M    | P0       | 2.1        |
| 2.3 | Sandbox CPU/mem caps via worker `resourceLimits` + hard timeout + kill-on-breach.                           | M    | P0       | —          |
| 2.4 | Restrict worker `require()` — module allow-list + `--no-addons`.                                            | M    | P0       | 2.3        |
| 2.5 | Manifest signature verification (Ed25519, publisher trust store from env-file).                             | M    | P0       | 1.6        |
| 2.6 | Persistent plugin lifecycle: install/enable/disable/uninstall committed to Prisma; migrations for it.       | S    | P1       | 0.5        |
| 2.7 | Plugin telemetry: invocations, errors, latency exposed via `/admin/plugins/telemetry`.                      | S    | P2       | 0.3        |
| 2.8 | SDK v1 lock: version `PluginContext`, add `ctx.secret`, `ctx.audit`, `ctx.perm`; publish `@hault/sdk`.      | M    | P0       | 2.1        |

Exit criteria: a malicious plugin cannot escape CPU/mem caps, cannot import outside the allow-list, cannot call a capability without a grant, and cannot install without a valid signature.

---

## Wave 3 — Persistence for stateful plugins (Weeks 5–8, overlaps Wave 2)

Turn the `ctx.kv`-only Tier B plugins into real tables. Follow the same shape for each so refactor cost is O(n) not O(n²).

| # | Task                                                                                          | Size | Priority | Depends on |
| - | --------------------------------------------------------------------------------------------- | ---- | -------- | ---------- |
| 3.1 | Prisma models for the core five: `tasks`, `notes`, `calendar`, `files`, `kanban`.             | M    | P1       | 0.5        |
| 3.2 | Adapter in each plugin swapping `ctx.kv` for typed repository (kept behind SDK helper).       | M    | P1       | 3.1, 2.8   |
| 3.3 | Files: wire to storage provider (local + S3), enforce quota, virus-scan hook (stub ok).       | M    | P1       | 3.1        |
| 3.4 | Extend to remaining Tier B plugins in batches (finance, health, habits, goals, bookmarks…).   | L    | P2       | 3.2        |

Exit criteria: data survives restarts, is per-user, is indexed, and is covered by RLS-equivalent logic in the repository layer.

---

## Wave 4 — AI engine & media pipeline (Weeks 6–10)

| # | Task                                                                                                | Size | Priority | Depends on |
| - | --------------------------------------------------------------------------------------------------- | ---- | -------- | ---------- |
| 4.1 | Streaming SSE endpoint `/ai/threads/:id/stream`; front-end consumes.                                | M    | P1       | 0.3        |
| 4.2 | Tool-calling loop wired through permission engine (no tool call without a grant).                   | M    | P1       | 2.2        |
| 4.3 | Swap in-memory RAG for pgvector (`@prisma/adapter` + `pgvector` extension); add `RagDocument` model.| M    | P1       | 0.5        |
| 4.4 | Real embeddings provider (OpenAI/Voyage) behind existing interface; keep `HashEmbeddings` for tests.| S    | P1       | 4.3        |
| 4.5 | Cost accounting: per user + per model, exposed on `/admin/api-usage`.                               | M    | P2       | 0.3        |
| 4.6 | Media pipeline: BullMQ queue for STT/OCR/vision; workers scale independently in compose.            | M    | P1       | 0.4        |
| 4.7 | Storage integration for uploads (signed URL upload, MIME sniff, size cap).                          | M    | P1       | 3.3        |

Exit criteria: streaming chat with tool calls that respect grants; RAG queries hit pgvector; media jobs run asynchronously.

---

## Wave 5 — Tier A plugins (Weeks 9–13)

Dangerous / integration-heavy plugins go last so they sit on a real sandbox + permission stack.

Order inside the wave (highest blast-radius first, so hardening reuses the same primitives):

1. `computer-control` — per-verb permission gate, OS allow-list, screenshot redaction.
2. `terminal` — session store, output size cap, resource kill.
3. `browser` — Playwright container image, per-session cookie jar, sandboxed downloads.
4. Comms: `gmail`, `outlook`, `discord`, `slack`, `telegram`, `whatsapp`, `sms-twilio` — real OAuth/webhooks, secret storage.
5. Dev: `github`, `docker`, `search`, `scraper` — API keys via `ctx.secret`, rate limits.

Size: **L per plugin**. **Priority: P1** for 1–3, **P2** for 4–5. **Depends on:** Waves 1–2.

---

## Wave 6 — Ops, deployment, DR (Weeks 12–14)

| # | Task                                                                                                  | Size | Priority | Depends on |
| - | ----------------------------------------------------------------------------------------------------- | ---- | -------- | ---------- |
| 6.1 | Prod docker-compose: non-root containers, healthchecks, resource limits, restart policies verified.   | M    | P0       | 0.4        |
| 6.2 | Reverse proxy with TLS (Caddy or nginx + certbot); HSTS + CSP + COOP headers.                         | M    | P0       | 6.1        |
| 6.3 | Automated Postgres backups (`pg_dump` cron to S3) + weekly restore test script.                       | M    | P0       | —          |
| 6.4 | `scripts/bootstrap.sh` — one-command VPS setup (env generate, migrate, seed admin, start).            | M    | P0       | 1.6        |
| 6.5 | Metrics: `/metrics` (Prometheus), Grafana dashboards for API + queues.                                | M    | P1       | 0.3        |
| 6.6 | Tracing: OpenTelemetry SDK + OTLP exporter, spans across API → plugin worker.                         | M    | P2       | 6.5        |
| 6.7 | Uptime probe + on-call alerting rules (auth error rate, permission denies, sandbox kills).            | S    | P1       | 6.5        |

Exit criteria: `bootstrap.sh` on a fresh VPS produces a TLS-terminated, backed-up, monitored HAULT instance.

---

## Wave 7 — Tests, docs, DX (continuous from Wave 1)

Runs alongside every wave; no wave is “done” without its tests.

| # | Task                                                                                        | Size | Priority | Depends on |
| - | ------------------------------------------------------------------------------------------- | ---- | -------- | ---------- |
| 7.1 | Vitest bootstrap for `apps/api`; unit tests for `crypto`, `permissions`, `auth`, `audit`.   | M    | P0       | 0.2        |
| 7.2 | Supertest integration tests for `/auth/*`, `/admin/*`, `/plugins/*`, `/permissions/*`.      | M    | P0       | 1.x, 2.x   |
| 7.3 | Plugin test harness (fake `ctx`) exported from `@hault/sdk`; ships in Wave 2.8.             | M    | P0       | 2.8        |
| 7.4 | Playwright e2e for login → grant permission → invoke plugin → audit visible in admin.       | M    | P1       | Wave 2     |
| 7.5 | OpenAPI generated from Nest metadata; served at `/docs`; typed client for web app.          | M    | P1       | 0.4        |
| 7.6 | Runbook (`docs/hault/RUNBOOK.md`) + threat model (`docs/hault/THREAT-MODEL.md`).           | M    | P1       | Wave 6     |
| 7.7 | ADRs for every reversal from the current scaffold (log ledger, RAG store, sandbox model).   | S    | P2       | continuous |

---

## Wave 8 — Native shells (post-web-GA)

Deferred deliberately: the web app is the source of truth; hardening the shells before the API is stable wastes cycles.

| # | Task                                                                                        | Size | Priority | Depends on |
| - | ------------------------------------------------------------------------------------------- | ---- | -------- | ---------- |
| 8.1 | Tauri auto-updater + code signing (macOS notarisation, Windows EV cert).                    | L    | P2       | Wave 6     |
| 8.2 | Desktop OS keychain integration for refresh token; deep-link OAuth callback.                | M    | P2       | 1.5        |
| 8.3 | Mobile EAS build profile + OTA channel; native camera/mic/notification bridges.             | L    | P3       | Wave 6     |

---

## Dependency diagram (compact)

```text
Wave 0 ──► Wave 1 ──► Wave 2 ──► Wave 5 (Tier A plugins)
                │           └──► Wave 3 (persistence) ──► Wave 4 (AI/media)
                │
                └──► Wave 6 (ops) ◄── Wave 4
                          ▲
                 Wave 7 (tests+docs, continuous)
                          ▲
                 Wave 8 (native shells, deferred)
```

---

## Milestones (calendar, one senior engineer)

- **M1 — End of Week 3:** Auth hardened, admin gated, keys rotatable, CI green. → *Safe to expose to trusted internal users.*
- **M2 — End of Week 6:** Permissions enforced end-to-end, sandbox real, SDK v1 locked. → *Safe to accept third-party plugins from trusted publishers.*
- **M3 — End of Week 10:** Core plugins on real persistence, AI streams with tool calls, media queued. → *Feature-complete for a private beta.*
- **M4 — End of Week 13:** Tier A plugins hardened. → *Public beta candidate.*
- **M5 — End of Week 14:** Ops/DR in place, tests + runbook shipped. → *Production GA.*

Native shells (Wave 8) start post-GA.

---

## Non-goals for this roadmap

- No new plugins.
- No new phases beyond 16.
- No architectural rewrites (Nest, Prisma, Postgres, Redis, worker-thread sandbox, TanStack-free web app all stay).
- No provider swaps unless the current provider has no viable production path (only pgvector for RAG qualifies, and it slots behind the existing `VectorStore` interface).

---

---

## Sprint 2.1 — Infrastructure Completion (delivered)

The following roadmap items are now complete. See
`docs/hault/infra-completion-report.md` for details.

- [x] Baseline Prisma migration + `migration_lock.toml`
- [x] Standard success + error response envelopes with `requestId`
- [x] Global `RequestIdMiddleware` and `x-request-id` echo
- [x] Config-driven `ThrottlerModule` (rate limiting)
- [x] CORS allow-list from `APP_URL` (comma-separated)
- [x] `TRUST_PROXY`, `APP_VERSION`, `ENABLE_SWAGGER` env plumbing
- [x] Swagger / OpenAPI at `/docs` and `/docs-json`
- [x] `.env.example` as canonical env reference
- [x] Health / readiness routes formally excluded from `/api` prefix

Deferred (documented as blockers B1–B8 in the completion report):
Prisma migration real-DB verification, sandbox v2, provider integration
tests, CI DB step, pino/OTLP wiring, Redis-backed throttler storage,
per-controller Swagger annotations, frontend envelope-unwrap audit.
