// HAULT desktop main process — Tauri v2.
// Registers native commands consumed by the Computer Control plugin over the
// bridge exposed in `apps/web/src/lib/native-bridge.ts`.
use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
struct NativeInfo {
    platform: String,
    version: String,
}

#[tauri::command]
fn native_info() -> NativeInfo {
    NativeInfo {
        platform: std::env::consts::OS.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[tauri::command]
async fn screen_capture() -> Result<String, String> {
    // Placeholder: real impl wires `screencapture` (macOS), `scrot`/`grim`
    // (Linux), or `PowerShell` (Windows) and returns a base64 PNG.
    Err("screen_capture not yet implemented on this platform".into())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![native_info, screen_capture])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let win = app.get_webview_window("main").unwrap();
                win.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running HAULT desktop");
}
