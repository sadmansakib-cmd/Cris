# HAULT — Architecture Documentation

HAULT is a self-hosted, modular AI operating system. It is **not** a Lovable-hosted app: after generation, this codebase runs standalone on any Docker-capable host, owned entirely by you.

## Non-negotiable principles

1. **Zero vendor lock-in.** Every external capability (AI, storage, email, payments, auth providers) sits behind a provider interface with at least two swappable implementations.
2. **Standard open technologies only.** TypeScript everywhere. NestJS backend, React+Vite frontend, PostgreSQL + Prisma, Redis, Docker.
3. **Every feature is a plugin.** Core is small; features are installable, disableable, removable modules with their own settings, permissions, migrations, and UI.
4. **Nothing runs without permission.** A central Permission Engine gates every side effect (read/write files, network, camera, mic, send email, etc.). Prompts are per-action or per-scope, revocable, and audited.
5. **Secrets never in code.** `.env.example` ships with placeholders only. All keys are user-supplied env vars.
6. **Production quality only.** No mocks, no stubs shipped as features, no demo auth, no fake APIs.

## Documents in this folder

| File | Purpose |
|---|---|
| [`01-architecture.md`](./01-architecture.md) | System overview, boundaries, request flow |
| [`02-folder-structure.md`](./02-folder-structure.md) | Monorepo layout, module isolation rules |
| [`03-database-schema.md`](./03-database-schema.md) | Prisma schema for Phase 1 core |
| [`04-plugin-system.md`](./04-plugin-system.md) | Plugin manifest, lifecycle, sandbox, marketplace |
| [`05-permission-engine.md`](./05-permission-engine.md) | Permission taxonomy, prompt/grant model, audit |
| [`06-provider-interfaces.md`](./06-provider-interfaces.md) | AI, Storage, Email, Payment, Auth, Vector, Queue |
| [`07-security.md`](./07-security.md) | Threat model, encryption, hardening checklist |
| [`08-deployment.md`](./08-deployment.md) | Docker Compose, GitHub Actions, VPS runbook |
| [`09-roadmap.md`](./09-roadmap.md) | Phases 1–14 broken into shippable milestones |

## Stack (locked)

- **Frontend:** React 19 + Vite + TypeScript + TailwindCSS + shadcn/ui + TanStack Router + TanStack Query + Zustand
- **Backend:** NestJS 10 + TypeScript + Prisma + PostgreSQL 16 + Redis 7 + BullMQ + Zod
- **Auth:** Argon2id passwords, JWT (short-lived) + rotating refresh tokens in httpOnly cookies, TOTP 2FA, WebAuthn (passkeys), optional OAuth (Google/GitHub/Microsoft) via generic adapter
- **Realtime:** WebSockets (Nest Gateway) + Redis pub/sub
- **Testing:** Vitest (unit), Playwright (e2e), Supertest (api)
- **Container:** Docker + docker-compose (api, web, postgres, redis, nginx, minio-optional)
- **CI:** GitHub Actions (lint, typecheck, test, build images, push to GHCR)
