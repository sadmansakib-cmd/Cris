// Phase 16 — Tauri desktop shell scaffold.
// A thin wrapper that hosts `apps/web` and proxies permission prompts through
// the same PermissionEngine as the browser client. Native capabilities
// (screen capture, keyboard hooks) are exposed via Tauri commands and
// consumed by the Computer Control plugin instead of shelling out to
// `xdotool` / `scrot` / etc.
//
// To materialize this shell:
//   1. `cargo install create-tauri-app` and run inside `apps/desktop/`.
//   2. Point Tauri to `../web/dist` as the dist-dir.
//   3. Register Tauri commands for: screen_capture, mouse_move, key_type,
//      clipboard_read, clipboard_write, notification_show.
//   4. In the web app, detect `window.__TAURI__` and route Computer Control
//      calls through Tauri commands when present, HTTP otherwise.
export const TAURI_CAPABILITIES = [
  'screen.capture', 'input.mouse', 'input.keyboard',
  'clipboard.read', 'clipboard.write',
  'notification.show', 'shell.exec',
] as const;
