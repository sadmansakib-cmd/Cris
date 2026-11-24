# Phase 10 — Health & Finance

Landed plugins (state via `ctx.kv`):

- `hault.health` — log any measurement kind (weight, sleep, steps, HR, etc.) with unit + note; `/summary` returns per-kind latest and 7-day average.
- `hault.finance` — accounts, transactions (income/expense sign convention), budgets, and `/report` with MTD income/expense, net worth, and per-budget utilization.

Web: `Life` tabbed page (Health, Finance) wired into the sidebar.

Both plugins are pure local state; no external API keys required. Future
integrations (Plaid, Apple Health, Google Fit) plug in as separate plugins
that write into these namespaces.
