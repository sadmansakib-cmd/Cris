# Phase 5 — Research (delivered)

End-to-end research pipeline: web search → article scrape → LLM synthesis
with inline citations, plus a citation formatter.

## Plugins

| Plugin                  | Verbs                    | Notes                                                    |
| ----------------------- | ------------------------ | -------------------------------------------------------- |
| `plugins/search`        | `POST /query`            | Brave / Tavily / SearXNG selectable via settings         |
| `plugins/scraper`       | `POST /extract`          | `@mozilla/readability` + `jsdom`; permission-gated fetch |
| `plugins/research-mode` | `POST /run`              | Orchestrates search → scrape → synth with `[n]` cites    |
| `plugins/citations`     | `POST /cite`             | APA / MLA / Chicago / BibTeX from URL or DOI (Crossref)  |

Every network call runs through `ctx.permissions.require('net.fetch', 'host:<h>', ...)`
and every secret read through `ctx.permissions.require('secret.read', ...)`.

## Runtime deps to add

```bash
pnpm --filter @hault/plugin-scraper add jsdom @mozilla/readability
pnpm --filter @hault/plugin-citations add jsdom
```

## Settings the operator must configure

| Key                       | Type    | Meaning                                     |
| ------------------------- | ------- | ------------------------------------------- |
| `search.provider`         | string  | `brave` (default), `tavily`, or `searxng`   |
| `search.searxng.url`      | string  | SearXNG base URL (self-hosted)              |
| secret `search.brave.key` | secret  | Brave Search API subscription token         |
| secret `search.tavily.key`| secret  | Tavily API key                              |

## Web app

- New `apps/web/src/pages/Research.tsx` — question box + `Run research`
  → renders answer + numbered source list with outbound links.
- Sidebar entry added in `AppShell.tsx`.

## Next up

- Phase 6 (Coding: repo analysis, PR review, test generation).
- Marketplace UI + signed manifest verification.
