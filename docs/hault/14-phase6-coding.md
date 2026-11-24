# Phase 6 — Coding

Landed plugins:

- `hault.code-editor` — sandboxed workspace filesystem (`/tree`, `/file`, `/delete`); paths confined via `path.relative` guards; `fs.write`/`fs.delete` gated.
- `hault.terminal` — `/exec` runs commands under `/bin/sh -lc` with a per-call `shell.exec` grant; stdout/stderr capped at 256KB; SIGKILL after `timeoutMs`.
- `hault.ai-coding` — `/generate`, `/review`, `/refactor`, `/tests` on top of `ctx.ai.complete`; `ai.invoke` gated.
- `hault.api-testing` — `/send` with per-host `net.fetch` gate; `/collections` stored via `ctx.kv`.
- `hault.github` — repos, issues, PRs, actions runs via GitHub REST; requires OAuth `github` token; mutations require `github.write`.
- `hault.code-docs` — `/docstrings`, `/readme` via AI.
- `hault.bug-perf` — `/triage`, `/hotspots` via AI.

Web UI: `Coding` tabbed page (`AI`, `Editor`, `Terminal`, `API`, `GitHub`) wired into the sidebar.

## SDK surfaces used

`ctx.ai.complete`, `ctx.oauth.token`, `ctx.permissions.require`,
`ctx.net.fetch`, `ctx.storage.root`, `ctx.kv.get/set`, `ctx.audit.log`.
Any not yet implemented in the SDK live shim are backed by the runtime
service in `apps/api/src/core/plugins/plugin-runtime.service.ts`.
