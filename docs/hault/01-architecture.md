# 01 — System Architecture

## High-level

```text
                ┌───────────────────────────────────────────────┐
                │                     Client                    │
                │  Web (React+Vite)   Desktop (Tauri, later)    │
                │  Mobile (Expo, later)                         │
                └──────────────┬────────────────┬───────────────┘
                               │ HTTPS/WSS      │
                               ▼                ▼
                     ┌─────────────────────────────────┐
                     │   Nginx (TLS, rate-limit, WAF)  │
                     └───────────────┬─────────────────┘
                                     ▼
        ┌────────────────────────────────────────────────────────┐
        │                    NestJS API                          │
        │  ┌──────────┐ ┌─────────────┐ ┌────────────────────┐  │
        │  │  Auth    │ │ Permissions │ │  Plugin Runtime    │  │
        │  └──────────┘ └─────────────┘ └─────────┬──────────┘  │
        │  ┌──────────┐ ┌─────────────┐ ┌─────────▼──────────┐  │
        │  │  Users   │ │  Settings   │ │  Loaded Plugins    │  │
        │  └──────────┘ └─────────────┘ │  (AI, Files, ...)  │  │
        │  ┌──────────────────────────┐ └────────────────────┘  │
        │  │ Provider Interfaces       │                        │
        │  │  AI • Storage • Email     │                        │
        │  │  Auth • Payment • Vector  │                        │
        │  └──────────────────────────┘                         │
        └──────┬──────────────┬───────────────┬─────────────────┘
               ▼              ▼               ▼
        ┌──────────┐   ┌───────────┐   ┌──────────────┐
        │ Postgres │   │  Redis    │   │  Object Store │
        │ +Prisma  │   │ BullMQ    │   │  (S3/R2/local)│
        └──────────┘   └───────────┘   └──────────────┘
```

## Layers

1. **Edge** — Nginx terminates TLS, enforces rate limits, forwards to API and static web bundle.
2. **API (NestJS)** — HTTP + WS. Every module is a Nest `DynamicModule` registered by the Plugin Runtime.
3. **Core services** — Auth, Permissions, Users, Settings, Notifications, Audit, Plugin Registry, Provider Registry. Cannot be removed.
4. **Plugin runtime** — Loads/enables/disables/uninstalls plugins at runtime. Each plugin declares permissions, routes, jobs, migrations, settings schema, UI extension points.
5. **Provider interfaces** — Every external dependency is an interface; implementations are swappable via env config.
6. **Data** — Postgres (source of truth), Redis (cache/queue/pubsub), object storage (files/blobs).

## Request lifecycle

1. Request hits Nginx → API.
2. `AuthGuard` verifies JWT (or refresh cookie for `/auth/refresh`).
3. `PermissionGuard` checks route metadata (`@RequiresPermission('files:read')`) against the user's granted permissions.
4. Controller delegates to a service. Services never talk to external APIs directly — always through a provider interface resolved from the `ProviderRegistry`.
5. Side effects that need approval (send email, delete file, run automation) go through the `PermissionEngine.request(actor, action, scope)` which either short-circuits (already granted) or emits a WS event to prompt the user.
6. Audit log written for every permission grant, denial, and privileged action.

## Module isolation rules

- A module MUST NOT import from another module's internals — only from its exported `PublicApi` barrel.
- A module MUST declare its DB tables under its own Prisma schema namespace prefix (`plugin_<slug>_*`).
- A module MUST be removable: uninstalling drops its tables (behind a confirmation), unregisters its routes, jobs, and UI.
- Core → Plugin: allowed (dependency inversion via interfaces exposed by core).
- Plugin → Core: only through documented interfaces (`@hault/sdk`).
- Plugin → Plugin: only through the event bus or a declared `dependsOn` in the manifest.
