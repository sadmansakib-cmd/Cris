# 07 — Security

## Threat model (summary)

| Threat                   | Mitigation                                                                 |
|--------------------------|----------------------------------------------------------------------------|
| Credential stuffing      | Argon2id, per-account + per-IP rate limits, breached-password check (HIBP k-anon) |
| Session hijacking        | Short-lived JWT (10 min) + rotating refresh in httpOnly SameSite=strict cookie, device binding, revocation on password change |
| XSS                      | React auto-escape; strict CSP (`script-src 'self'`); no `dangerouslySetInnerHTML` on user input; DOMPurify for any HTML rendering |
| CSRF                     | SameSite cookies + double-submit CSRF token for state-changing endpoints; JSON APIs require `Content-Type: application/json` |
| SQL injection            | Prisma parameterized queries; no raw SQL from user input; explicit `$queryRawUnsafe` ban via ESLint |
| SSRF                     | All outbound fetch goes through `SafeFetch` which resolves DNS, blocks RFC1918/loopback/link-local, enforces `sandbox.network` allowlist |
| Path traversal           | Storage keys normalized + validated against a per-scope root; no `..` |
| Privilege escalation     | Role stored in `User.isAdmin` only; every admin route double-checks; no role in JWT-only trust |
| Plugin abuse             | Sandbox + PermissionEngine + audit; marketplace signatures |
| Brute-force MFA          | Rate-limit `/auth/mfa/verify`; lock after N failures, backoff |
| Secrets in logs          | Redaction middleware on logger; env var names allowlisted for debug dump |
| Ransomware / data loss   | Backup job (pg_dump + object-store snapshot) with off-host copy target |
| DoS                      | Nginx rate-limit + Nest `@Throttle` per route + BullMQ concurrency caps |

## Cryptography

- **Passwords:** Argon2id (m=64MiB, t=3, p=1).
- **Symmetric:** AES-256-GCM, unique 96-bit IV per record, AAD = `table:column:pk`.
- **Keys:** `ENCRYPTION_KEY` (32-byte base64) from env; documented KMS integration path (AWS KMS / GCP KMS / Vault) as a `KeyProvider` interface.
- **Tokens:** JWT HS256 with `JWT_SECRET` (or RS256 with rotating JWKS — configurable).
- **Refresh tokens:** 256-bit random, only sha256 hash stored.
- **TOTP:** RFC 6238, 30s window, ±1 skew, 8-char base32 recovery codes (10x, single-use, hashed).

## Headers (Nginx + Nest)

```
Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; connect-src 'self' wss:; frame-ancestors 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

## Rate limits (defaults)

| Route                    | Limit                    |
|--------------------------|--------------------------|
| `/auth/login`            | 5 / 15min / IP + account |
| `/auth/mfa/verify`       | 5 / 15min / account      |
| `/auth/register`         | 3 / hour / IP            |
| `/auth/password/reset`   | 3 / hour / account       |
| `POST /api/**` (default) | 60 / min / user          |

## Audit

Every: login, logout, permission grant/deny/revoke, plugin install/enable/disable, admin action, data export/delete. Immutable append-only table; export as JSONL from admin UI.

## Backups

Daily `pg_dump --format=custom` + object-store snapshot; retention 30d local, 90d off-host. Restore drill documented in `08-deployment.md`.

## Dependency hygiene

- Renovate weekly PRs.
- `pnpm audit --prod` gate in CI (fails on high/critical).
- SBOM (`syft`) attached to each release.
