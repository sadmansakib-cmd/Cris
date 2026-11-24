# 24 — Phase 16: Desktop (Tauri) & Mobile (Expo)

Both shells reuse `apps/web` — no forked UI. Native capabilities are exposed
through a single bridge (`apps/web/src/lib/native-bridge.ts`), and plugins
detect it via `platform()` / `isNative()`.

## Desktop — `apps/desktop/` (Tauri v2)

- `tauri.conf.json` — points `frontendDist` at `../web/dist`, `devUrl` at the Vite dev server.
- `src-tauri/Cargo.toml` — pulls in shell / clipboard / notification / fs / dialog plugins.
- `src-tauri/src/main.rs` — registers `native_info` and a `screen_capture` stub for the Computer Control plugin.
- `src-tauri/capabilities/default.json` — least-privilege capability set for the main window.

Run: `cargo tauri dev` from `apps/desktop/`. Requires Rust toolchain and Tauri v2 CLI.

## Mobile — `apps/mobile/` (Expo Router)

- `app.json` — Expo config with iOS/Android permissions (microphone, camera, notifications).
- `app/_layout.tsx` + `app/index.tsx` — Expo Router root that mounts a WebView pointed at the HAULT web UI.
- `WebView` injects `window.__HAULT_MOBILE__` before load; commands are handled in `runCommand()` via `expo-secure-store`, notifications, etc.

Run: `pnpm --filter @hault/mobile start` then press `i` / `a`.

## Native bridge — `apps/web/src/lib/native-bridge.ts`

Single entry point used by plugins:

```ts
import { isNative, invokeNative, nativeInfo } from '@/lib/native-bridge';

if (isNative()) {
  const token = await invokeNative<string>('secure.get', { key: 'jwt' });
}
```

- `platform()` → `'web' | 'desktop' | 'mobile'`
- `invokeNative(cmd, args)` — routes to Tauri `invoke` on desktop, `postMessage` on mobile, throws in browser.

Permission prompts still route through the same `PermissionEngine` regardless
of shell — the native surface only supplies capabilities, never bypasses
consent.
