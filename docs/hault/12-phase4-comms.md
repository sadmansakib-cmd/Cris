# Phase 4 — Communication (delivered)

Wired end-to-end message send/receive plugins with permission-gated network calls
and a Communications hub in the web app.

## Plugins with real implementations

| Plugin                      | Verbs                                          | Auth surface                     |
| --------------------------- | ---------------------------------------------- | -------------------------------- |
| `plugins/gmail`             | `/inbox`, `/message/:id`, `/send`, `/modify`   | Google OAuth (`ctx.oauth`)       |
| `plugins/slack`             | `/webhook`, `/message`                         | Bot token in `settings.getSecret` |
| `plugins/discord`           | `/webhook`, `/channel`                         | Bot token in `settings.getSecret` |
| `plugins/telegram`          | `/send`                                        | Bot token in `settings.getSecret` |

Every verb calls `ctx.permissions.require(action, scope, reason)` before
network / secret access, and writes to `ctx.audit.log` on success.

## SDK expansion (`packages/sdk/src/index.ts`)

Formalised the `PluginContext` surface that plugin authors have been using:
`http`, `ws`, `permissions`/`perms`, `storage`, `net`, `oauth`, `audit`,
`settings`, `kv`, `log`/`logger`. Definitions now match every reference
plugin (ai-chat, browser, computer-control, gmail, slack, discord, telegram).

## Prisma additions

Added `ChatThread` and `ChatMessage` models to unblock `AiService` (Phase 1
completion). Run:

```bash
pnpm --filter @hault/api prisma migrate dev -n chat_and_comms
```

## Web app

- New `apps/web/src/pages/Communications.tsx` — tabbed hub for Gmail
  (inbox + compose), Slack, Discord, Telegram.
- Sidebar entry added in `AppShell.tsx`.

## Next up

- Phase 5 (Research: web search, scraping pipelines, citations).
- Phase 6 (Coding: repo analysis, PR review, test generation).
- Plugin marketplace UI + signed manifest verification (started in
  `apps/api/src/core/plugins/marketplace/`).
