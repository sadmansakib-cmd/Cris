# Phase 8 — Knowledge & Files

Landed plugins:

- `hault.files` — list / read / write / move / delete / hash / search under `ctx.storage.root`; path-escape guarded; mutations gated by `fs.write` / `fs.delete`.
- `hault.folders` — mkdir / move / delete / tree.
- `hault.zip` — `.zip` (adm-zip) and `.tar[.gz]` (tar) create/extract.
- `hault.clipboard` — history with pinned snippets, 200-entry cap that keeps pins.
- `hault.downloads` — streaming fetch with progress, sha256 verify, per-host `net.fetch` gate.
- `hault.knowledge-graph` — reads `hault.notes` via `ctx.host.invoke`, returns `{ nodes, edges }` and top hubs by in-degree.
- `hault.screenshot` — server-side upload/list/annotate; real desktop capture is delegated to the Tauri shell (docs/hault/16).
- `hault.ocr` — uses `ctx.host.providers.ocr` when registered; falls back to multimodal AI completion (`ai.invoke` gated).
- `hault.bookmarks` — CRUD with tags and search.

Web: `Knowledge & Files` tabbed page (files, bookmarks, clipboard, downloads, screenshots, graph) wired into the sidebar.

Runtime deps for the API worker: `adm-zip`, `tar`.
