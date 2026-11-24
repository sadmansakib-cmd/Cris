# 23 — Phase 15: Admin

Read-only operator surface over existing Prisma models. No schema changes.

## API

- `GET  /admin/logs?limit&outcome&action&userId` — audit stream with filters
- `GET  /admin/errors?limit` — `outcome=error` slice
- `GET  /admin/analytics?days=7` — totals + top actions in window
- `GET  /admin/api-usage?days=7` — action × outcome counts
- `GET  /admin/sessions` — recent 200 sessions
- `DELETE /admin/sessions/:id` — revoke session (sets `revokedAt`)
- `GET  /admin/security` — 24h denies/errors, active sessions, MFA users
- `GET  /admin/backup/snapshot` — logical row counts (pair with `pg_dump`)

All endpoints are behind `JwtAuthGuard`; add a role check in Phase 15.1 when the
admin role is promoted from the boolean flag to the RBAC engine.

## Web

`apps/web/src/pages/Admin.tsx` — tabs for Logs, Errors, Analytics, API Usage,
Sessions (with revoke), Security, Backup. Wired into the sidebar with the
`Shield` icon.
