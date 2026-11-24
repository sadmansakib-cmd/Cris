# 08 — Deployment (Self-hosted VPS via Docker Compose)

Target: any Linux VPS (2 vCPU / 4 GB RAM minimum for Phase 1) with Docker Engine ≥ 24.

## Topology

```text
              ┌────────────────────────────────────┐
              │            VPS (Ubuntu)            │
              │                                    │
              │  ┌─── docker network: hault ────┐  │
              │  │                              │  │
              │  │  nginx  ──►  web (static)    │  │
              │  │        └─►  api (nest)       │  │
              │  │  api  ──►  postgres          │  │
              │  │  api  ──►  redis             │  │
              │  │  api  ──►  minio (optional)  │  │
              │  │                              │  │
              │  └──────────────────────────────┘  │
              │  Volumes: pgdata, redisdata,       │
              │           filesdata, letsencrypt   │
              └────────────────────────────────────┘
```

## `docker-compose.prod.yml` (shape)

```yaml
services:
  nginx:
    image: nginx:1.27-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./docker/nginx/conf.d:/etc/nginx/conf.d:ro
      - letsencrypt:/etc/letsencrypt
    depends_on: [api, web]

  web:
    image: ghcr.io/you/hault-web:${TAG}
    restart: unless-stopped

  api:
    image: ghcr.io/you/hault-api:${TAG}
    env_file: .env
    depends_on: [postgres, redis]
    volumes:
      - filesdata:/var/hault/files      # when STORAGE_DEFAULT_PROVIDER=local
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: hault
      POSTGRES_USER: hault
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: [pgdata:/var/lib/postgresql/data]
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    volumes: [redisdata:/data]
    restart: unless-stopped

volumes: { pgdata: {}, redisdata: {}, filesdata: {}, letsencrypt: {} }
```

## First boot

```bash
git clone <repo> hault && cd hault
cp .env.example .env && $EDITOR .env      # fill DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, provider keys
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose exec api pnpm prisma migrate deploy
docker compose exec api pnpm prisma db seed        # prints temp admin password
```

## TLS

Certbot sidecar (or use Caddy instead of Nginx if simpler): auto-renew via cron, HTTP-01 challenge over port 80.

## Backups

```cron
15 3 * * *  /opt/hault/scripts/backup.sh
```

`backup.sh`:
1. `docker compose exec -T postgres pg_dump -U hault -Fc hault > /backups/hault_$(date +%F).dump`
2. If `STORAGE_DEFAULT_PROVIDER=local`: `tar -C /var/lib/docker/volumes/filesdata/_data -czf ...`.
3. `rclone copy /backups <off-host-remote>:hault-backups`.
4. Retain 30 local / 90 off-host.

## Restore

```bash
docker compose exec -T postgres pg_restore -U hault -d hault --clean --if-exists < hault_YYYY-MM-DD.dump
# then restore files volume
```

## GitHub Actions (`.github/workflows`)

- `ci.yml` — on PR: install → lint → typecheck → test (unit+integration with Postgres service) → build.
- `docker.yml` — on tag `v*`: build multi-arch images (`amd64`, `arm64`), push to `ghcr.io/you/hault-{api,web}:vX.Y.Z` + `:latest`, sign with cosign, attach SBOM.
- `release.yml` — generate changelog from Conventional Commits, create GitHub Release.

## Observability

- Structured JSON logs to stdout → collected by Loki/Grafana or Docker log driver.
- `/api/health` (liveness) + `/api/health/ready` (checks DB + Redis).
- OpenTelemetry SDK wired but OTLP endpoint left empty by default.

## Alternative targets

- **Railway / Render:** map each service to a managed service; use managed Postgres + Redis; set the same env.
- **Kubernetes:** Helm chart in `deploy/helm/` (later milestone).
- **AWS/GCP/Azure:** run the same compose on a VM, or split into managed services using the provider interfaces.

Nothing in the code assumes a specific host.
