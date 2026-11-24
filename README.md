# HAULT

Self-hosted, modular AI operating system. Owned entirely by you — no vendor lock-in, no proprietary runtime.

- **Stack**: NestJS + Prisma + PostgreSQL + Redis (api) · React 19 + Vite + TailwindCSS (web) · Docker Compose (deploy)
- **Architecture**: [`docs/hault/`](./docs/hault/README.md)

## Quick start (dev)

```bash
# 1. Prerequisites: Node ≥ 20.11, pnpm 9, Docker
corepack enable && corepack use pnpm@9.12.0
pnpm install

# 2. Copy env and generate secrets
cp .env.example .env
# then edit .env: set JWT_SECRET (openssl rand -base64 64) and ENCRYPTION_KEY (openssl rand -base64 32)

# 3. Start Postgres + Redis
docker compose up -d postgres redis

# 4. Migrate + seed
pnpm prisma:migrate
pnpm prisma:seed       # prints a temporary admin password

# 5. Run
pnpm dev               # api on :3000, web on :5173
```

## Production (docker compose)

```bash
cp .env.example .env && $EDITOR .env
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec api pnpm prisma migrate deploy
docker compose exec api pnpm prisma db seed
```

## Repository layout

```
apps/
  api/          NestJS backend (auth, permissions, plugins, providers)
  web/          React + Vite frontend
  cris-agent/   Voice-controlled local Windows PC assistant (Python 3.11)
packages/
  sdk/          @hault/sdk — plugin authoring API
  shared/       shared zod schemas + DTOs
docker/         nginx, postgres init
docs/hault/     architecture documentation
```

See [`docs/hault/README.md`](./docs/hault/README.md) for the full spec.

## Cris Voice Assistant

Cris is a local, voice-controlled Windows PC assistant (Python 3.11) located in [`apps/cris-agent/`](./apps/cris-agent/README.md). It operates with local wake word detection ("Hey Cris"), Gemini models, bilingual support (English and Bengali), desktop automation, and an autonomous app-builder workflow. See [`apps/cris-agent/README.md`](./apps/cris-agent/README.md) for Windows setup and quickstart instructions.

## License

MIT — you own this code.
