# Phase 16 — Desktop (Tauri) & Mobile (Expo) shells

Both native shells reuse `apps/web` unchanged. The only thing they add is a
platform-native transport for the Computer Control plugin (screen capture,
input synthesis, clipboard, notifications).

## Desktop (Tauri)

```
apps/desktop/
├─ src-tauri/
│  ├─ Cargo.toml
│  ├─ tauri.conf.json           # points distDir → ../../web/dist
│  └─ src/
│     ├─ main.rs                # #[tauri::command] handlers below
│     └─ commands/
│        ├─ screen.rs           # uses `screenshots` crate
│        ├─ input.rs            # uses `enigo` crate
│        └─ clipboard.rs        # uses `arboard` crate
└─ package.json                 # scripts: "tauri:dev", "tauri:build"
```

Commands to register: `screen_capture`, `mouse_move`, `mouse_click`,
`key_type`, `clipboard_read`, `clipboard_write`, `notification_show`,
`shell_exec` (behind permission).

The web app detects `window.__TAURI__` and routes Computer Control calls
through `invoke()` instead of HTTP. Permission prompts still go through the
same WebSocket to the HAULT API.

## Mobile (Expo)

```
apps/mobile/
├─ app.json
├─ App.tsx                       # WebView pointing at the HAULT web URL
└─ modules/
   ├─ notifications.ts           # expo-notifications
   ├─ camera.ts                  # expo-camera (for OCR / QR)
   └─ clipboard.ts               # expo-clipboard
```

Push notifications route through Expo's push service; a Notifications
provider adapter (`ExpoPushProvider`) plugs into the core Notifications
module.

## Permission engine parity

All three shells (web, desktop, mobile) use the same `PermissionEngine`
running in `apps/api`. The prompt UI in `apps/web` is reused verbatim,
because the WebSocket gateway is transport-agnostic.
