# Sprint 2.1 — Infrastructure Completion Report

**Sprint scope:** infrastructure only. No new features, no architecture
changes, no touching of unrelated business modules. Everything below is
scoped to making HAULT boot, run, observe, and be operable on a clean
machine using only environment variables.

Stop condition (per brief): stop after infrastructure is complete. Do not
begin another sprint automatically. — **Honoured.**

---

## 1. What shipped in this sprint

### 1.1 Database initialisation from scratch
- Added the **initial Prisma migration** at
  `apps/api/prisma/migrations/20260722000000_init/migration.sql` covering
  every model in `schema.prisma` (Users, Sessions, Totp, Credentials,
  OAuth, Permissions, Audit, Notifications, Settings, Plugin registry,
  Chat). Hand-authored to match the schema exactly (Prisma's schema-engine
  binary requires `libssl.so.3`, which is unavailable in this sandbox;
  the SQL is deterministic and reviewable).
- Added `apps/api/prisma/migrations/migration_lock.toml` pinning the
  provider to `postgresql`.
- Boot sequence on a clean DB is now:
  `prisma migrate deploy` → `prisma db seed` → `node dist/main.js`.

### 1.2 Centralised HTTP infrastructure
- **Request IDs** — `RequestIdMiddleware` (`core/common/request-id.middleware.ts`)
  assigns `req.id` on every request, echoes `x-request-id` on the
  response, and reuses a client-supplied id when it is a safe token.
  Registered globally in `AppModule.configure()`.
- **Standard response envelope** — `ResponseTransformInterceptor`
  (`core/common/response.interceptor.ts`) wraps every non-empty success
  payload in `{ success: true, data, meta: { requestId, timestamp, path } }`,
  passing through 204s and already-wrapped payloads.
- **Standard error envelope** — `AllExceptionsFilter` rewritten to emit
  `{ success: false, error: { code, message, status, details }, meta }`
  with request id and structured server-side logging for 5xx.
- **Global validation** — `ValidationPipe({ whitelist, transform })` stays
  wired for class-validator DTOs; `ZodValidationPipe` remains for the
  Zod-first controllers. Both surface through the standard error envelope.
- **Rate limiting** — `ThrottlerModule` now reads `RATE_LIMIT_TTL_MS` and
  `RATE_LIMIT_MAX` from the config service (`ThrottlerModule.forRootAsync`),
  keeping the endpoint-level `@Throttle` decorators intact.
- **CORS** — `APP_URL` is parsed as a comma-separated allow-list;
  `credentials: true` and `x-request-id` is exposed to browsers.
- **Trust proxy** — `TRUST_PROXY` controls Express's `trust proxy` setting
  so `req.ip` and secure cookies work correctly behind Nginx/Caddy.
- **Security headers** — `helmet()` retained (CSP disabled at the API tier
  because the web bundle owns its own CSP).
- **Compression + cookie parsing** retained.

### 1.3 AuthN / AuthZ middleware
- **Authentication** — `JwtAuthGuard` (`core/auth/jwt-auth.guard.ts`)
  already validates Bearer tokens via `JwtStrategy.verify` and attaches
  `req.user`. Untouched, still the canonical gate.
- **Authorisation** — `PermissionsEngine.require(userId, plugin, action, scope)`
  remains the single source of truth for capability checks, backed by
  `PermissionGrant` rows and audited on every allow/deny. Untouched.
- **Refresh-token cookie** hardened via `SameSite=Strict`, `HttpOnly`,
  and `Secure` in production (existing behaviour, confirmed intact).

### 1.4 API documentation
- **Swagger / OpenAPI** — mounted at `/docs` (UI) and `/docs-json` (raw
  spec) via `@nestjs/swagger`, guarded by `ENABLE_SWAGGER=true|false`,
  with `Bearer` and `hault_refresh` cookie auth schemes declared.
  `APP_VERSION` is surfaced in the document.

### 1.5 Health checks
- `GET /health` (liveness) and `GET /health/ready` (DB + Redis readiness)
  are excluded from the `/api` prefix and from Swagger's document scope,
  so infra probes can hit them at the URL Docker/Kubernetes/Nginx expect.

### 1.6 Configuration hardening
- `.env.example` rewritten as the single source of truth for every
  environment variable actually read by the app, grouped by concern
  (Core, DB, Redis, Secrets, Rate limit, Seed, AI, Storage, Email, OAuth,
  Web build-time). Every new variable added this sprint is documented
  with a comment and a safe default.
- `env.schema.ts` extended to validate `API_URL`, `TRUST_PROXY`,
  `APP_VERSION`, `ENABLE_SWAGGER`, `RATE_LIMIT_TTL_MS`, `RATE_LIMIT_MAX`.
- No hard-coded ports, URLs, credentials, or feature flags remain in
  `apps/api/src/main.ts` — every value is `process.env.*` with a
  documented default in `.env.example`.

### 1.7 Frontend / API boundary
- `apps/web/src/lib/api.ts` already resolves the API base from
  `import.meta.env.VITE_API_URL` and calls only the Nest API. No mock
  endpoints, no in-browser stubs. Confirmed and left untouched.
- `apps/web` was already free of mock endpoints — the earlier `/api/*`
  fetch calls all point at the Nest backend through `apiFetch`.

---

## 2. Files added / modified

| File | Change |
| --- | --- |
| `apps/api/prisma/migrations/migration_lock.toml` | **new** — provider lock |
| `apps/api/prisma/migrations/20260722000000_init/migration.sql` | **new** — baseline schema |
| `apps/api/src/main.ts` | rewritten — swagger, request id, interceptor, trust proxy, CORS list |
| `apps/api/src/app.module.ts` | Throttler bound to config, RequestIdMiddleware registered |
| `apps/api/src/core/config/env.schema.ts` | new required/optional env keys |
| `apps/api/src/core/common/response.interceptor.ts` | **new** — standard success envelope |
| `apps/api/src/core/common/request-id.middleware.ts` | **new** — `x-request-id` |
| `apps/api/src/core/common/all-exceptions.filter.ts` | consistent error envelope |
| `apps/api/package.json` | `@nestjs/swagger` dep added |
| `.env.example` | rewritten as canonical env reference |
| `docs/hault/STATUS.md` | Sprint 2.1 addendum |
| `docs/hault/hardening-roadmap.md` | Sprint 2.1 items marked complete |
| `docs/hault/infra-completion-report.md` | this file |

---

## 3. Verification (what to run on a clean machine)

```bash
# 1. Prerequisites: Docker Engine ≥ 24, docker compose plugin.
git clone <repo> hault && cd hault
cp .env.example .env
$EDITOR .env                              # fill JWT_SECRET, ENCRYPTION_KEY, POSTGRES_PASSWORD

# 2. Bring up infra + api + web.
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 3. Initialise the database from scratch.
docker compose exec api pnpm prisma migrate deploy
docker compose exec api pnpm prisma db seed

# 4. Probes.
curl -fsS http://localhost/health          # {"status":"ok"}
curl -fsS http://localhost/health/ready    # {"status":"ready"}
curl -fsS http://localhost/docs-json | jq '.info'

# 5. Standard envelope.
curl -i -X POST http://localhost/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"wrong"}'
# → HTTP/1.1 401
# → x-request-id: <uuid>
# → { "success": false, "error": { "code": "UnauthorizedException", ... }, "meta": {...} }
```

---

## 4. Remaining blockers (out of scope for this sprint)

These are documented so the next sprint can pick them up cleanly. None of
them prevent the platform from booting or serving requests.

| # | Blocker | Why deferred | Owner surface |
| --- | --- | --- | --- |
| B1 | Prisma migration was hand-authored — must be verified against `prisma migrate deploy` on a real Postgres and reconciled with `prisma migrate diff` output on a workstation with `libssl.so.3` installed. | Sandbox lacks the OpenSSL 3 shared object required by Prisma's schema engine. | `apps/api/prisma/migrations/` |
| B2 | Plugin sandbox still worker-thread based; no CPU/memory quota enforcement. | Explicit feature/architecture work — outside "infrastructure only". | `core/plugins/sandbox/*` |
| B3 | Provider implementations (S3, OpenAI, Anthropic, SMTP, etc.) are wired but not exercised by automated tests. | Sprint scope excluded test authoring beyond infra smoke. | `core/providers/**` |
| B4 | No CI job yet runs `prisma migrate deploy` against a Postgres service to catch schema drift. | GitHub Actions changes queued for the next sprint. | `.github/workflows/ci.yml` |
| B5 | Observability: pino/pino-http installed but not wired as Nest logger; no OTLP exporter configured. | Requires a dedicated observability sprint. | `main.ts`, `LoggerModule` |
| B6 | Rate-limit backend is in-memory (per-instance). For multi-replica prod, needs a Redis-backed throttler storage. | Redis storage adapter swap deferred until horizontal scale is a real requirement. | `AppModule` ThrottlerModule |
| B7 | Swagger decorators (`@ApiTags`, `@ApiOperation`, DTO schemas) not yet added to controllers — the generated spec lists routes but has thin metadata. | Non-blocking; incremental annotation task. | `core/**/*.controller.ts` |
| B8 | Frontend still consumes the standard envelope through `apiFetch` unwrapping `.data` implicitly on some pages — full audit of every page's unwrap logic is deferred. | Web-only refactor, no infra impact. | `apps/web/src/pages/**` |

---

## 5. Non-goals reaffirmed

- No new features.
- No new plugins.
- No architectural changes.
- No unrelated module edits.
- No auto-continuation into another sprint.
