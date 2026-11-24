# 02 — Folder Structure

Monorepo managed by **pnpm workspaces** + **Turborepo**.

```text
hault/
├── apps/
│   ├── api/                       # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── core/              # cannot be removed
│   │   │   │   ├── auth/          # email+pw, TOTP, WebAuthn, OAuth adapter
│   │   │   │   ├── users/
│   │   │   │   ├── permissions/   # PermissionEngine + guards + audit
│   │   │   │   ├── settings/
│   │   │   │   ├── notifications/
│   │   │   │   ├── plugins/       # PluginRegistry, loader, sandbox
│   │   │   │   ├── providers/     # ProviderRegistry
│   │   │   │   ├── audit/
│   │   │   │   ├── health/
│   │   │   │   └── common/        # guards, filters, pipes, decorators
│   │   │   ├── providers/         # concrete provider impls
│   │   │   │   ├── ai/            # openai, anthropic, gemini, ollama
│   │   │   │   ├── storage/       # local, s3, r2, gcs, azure
│   │   │   │   ├── email/         # smtp, resend, postmark, ses
│   │   │   │   ├── vector/        # pgvector, qdrant, chroma
│   │   │   │   ├── queue/         # bullmq
│   │   │   │   └── payment/       # stripe, paddle (later)
│   │   │   └── plugins/           # first-party plugins (still plugins)
│   │   │       ├── ai-chat/
│   │   │       ├── files/
│   │   │       └── ...
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── test/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── web/                       # React + Vite frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── app/               # router, providers, layout
│       │   ├── core/
│       │   │   ├── auth/
│       │   │   ├── permissions/   # permission prompt UI
│       │   │   ├── plugin-host/   # renders plugin UI extension points
│       │   │   ├── theme/         # ThemeEngine
│       │   │   ├── settings/
│       │   │   └── notifications/
│       │   ├── plugins/           # first-party plugin UIs
│       │   ├── components/ui/     # shadcn/ui
│       │   ├── lib/
│       │   └── styles/
│       ├── public/
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── sdk/                       # @hault/sdk — plugin authoring API (types, decorators, hooks)
│   ├── shared/                    # zod schemas, DTOs, enums shared web/api
│   ├── config/                    # eslint, tsconfig, tailwind presets
│   └── ui/                        # shared React primitives (optional)
│
├── plugins/                       # OUT-OF-TREE plugins live here or installed to var/plugins/
│
├── docker/
│   ├── nginx/
│   └── postgres/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .github/workflows/             # ci.yml, release.yml, docker.yml
├── docs/
│   └── hault/                     # this folder
├── .env.example
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Rules

- Every folder under `core/`, `providers/<kind>/`, and `plugins/<slug>/` is a Nest module with `index.ts` exporting only its **public API**.
- Feature folders are self-contained: `controller.ts`, `service.ts`, `dto/`, `schema.prisma.part` (merged at build), `permissions.ts`, `settings.schema.ts`, `README.md`, `tests/`.
- No file may import via a relative path that escapes its module (`../../other-module` is banned by ESLint rule).
