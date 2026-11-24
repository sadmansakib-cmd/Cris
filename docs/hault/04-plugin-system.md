# 04 — Plugin System

Every feature beyond the core (auth, users, permissions, settings, notifications, plugin registry, provider registry, audit) is a **plugin**. First-party features (AI chat, files, calendar…) are plugins too — they just ship in the repo.

## Manifest (`hault.plugin.json`)

```json
{
  "slug": "ai-chat",
  "name": "AI Chat",
  "version": "1.0.0",
  "description": "Multi-provider chat with memory.",
  "author": "you",
  "license": "MIT",
  "entry": {
    "server": "dist/server/index.js",
    "web":    "dist/web/index.js"
  },
  "permissions": [
    { "action": "ai:complete",   "reason": "Send prompts to the configured AI provider." },
    { "action": "memory:write",  "reason": "Save chat history." }
  ],
  "providers": {
    "requires": ["ai", "vector"]
  },
  "settingsSchema": "settings.schema.json",
  "ui": {
    "sidebar": [{ "id": "chat", "label": "Chat", "icon": "message-circle", "route": "/chat" }],
    "routes":  [{ "path": "/chat", "component": "ChatPage" }],
    "widgets": [{ "id": "recent-chats", "slot": "dashboard.main" }]
  },
  "jobs": [{ "id": "summarize-daily", "cron": "0 3 * * *" }],
  "dependsOn": [],
  "migrations": "prisma/migrations",
  "sandbox": { "network": ["ai-provider"], "fs": [], "cpuMs": 5000, "memMb": 256 }
}
```

## Lifecycle

```text
discover → validate → install → migrate → register → enable ⇄ disable → uninstall → drop
```

1. **discover** — scan built-in `plugins/`, on-disk `var/plugins/`, marketplace registry.
2. **validate** — manifest schema, signature (optional), permission list, version compatibility.
3. **install** — copy files, insert `Plugin` row, run its Prisma migrations.
4. **register** — dynamically add its Nest module, mount routes under `/api/plugins/<slug>`, register jobs, expose settings.
5. **enable / disable** — flip `Plugin.enabled`; disabled plugins do not receive requests and their jobs are paused.
6. **uninstall** — unregister, run down-migrations (or drop `plugin_<slug>_*` tables behind a "delete data" confirmation), remove files.

## Server SDK (`@hault/sdk`)

```ts
import { definePlugin, requiresPermission, useProvider } from "@hault/sdk";

export default definePlugin({
  slug: "ai-chat",
  routes: (router) => {
    router.post("/messages", requiresPermission("ai:complete"), async (ctx) => {
      const ai = useProvider("ai");                     // resolved from ProviderRegistry
      const answer = await ai.complete({ messages: ctx.body.messages, user: ctx.user });
      return { answer };
    });
  },
  jobs: {
    "summarize-daily": async ({ user, logger }) => { /* ... */ },
  },
});
```

## Web SDK

Plugins export React components; the host renders them into declared extension slots (`sidebar`, `dashboard.main`, `settings.tabs`, `command-palette`, …). Plugins never mount their own router — they receive one from the host.

## Sandbox

Server-side plugins run inside the same Node process by default (trusted, first-party). Untrusted / marketplace plugins run in a **worker_threads** sandbox with:

- No `require` outside a whitelisted set (`@hault/sdk`, plus provider handles injected via `postMessage` proxy).
- No direct network — outbound fetch is proxied by the host and checked against `sandbox.network` allowlist.
- No direct filesystem — file ops go through the Storage provider with scoped root.
- CPU + memory limits enforced (kill on exceed), timeout per request.
- Every syscall-equivalent goes through the Permission Engine.

## Marketplace

Registry is a static JSON index served over HTTPS. Signature verification via minisign public key baked into the app. Users can also install by uploading a `.hault` tarball.
