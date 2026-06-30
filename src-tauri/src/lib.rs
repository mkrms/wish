// Wish デスクトップシェル。
// - グローバルホットキー（既定 Alt+Space）でウィンドウを前面化しコマンドパレットを開く
// - システムトレイ常駐（クリックで表示/非表示、メニューから終了）
// - ウィンドウを閉じてもトレイに残る（ゼロ摩擦の即時起動のため）
// - 二重起動を防ぎ、既存ウィンドウを前面化

use tauri::{
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::ShortcutState;

const MAIN: &str = "main";

/// メインウィンドウを表示・前面化し、フロントへパレットを開くよう通知。
fn show_and_capture(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window(MAIN) {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        let _ = app.emit("toggle-palette", ());
    }
}

/// ウィンドウの表示/非表示をトグル。
fn toggle_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window(MAIN) {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.unminimize();
            let _ = win.set_focus();
        }
    }
}

/// 設定変更時にフロントから呼ばれ、グローバルホットキーを再登録する。
#[tauri::command]
fn set_global_shortcut(app: tauri::AppHandle, accelerator: String) -> Result<(), String> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    gs.register(accelerator.as_str()).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 二重起動時は既存ウィンドウを前面化。
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_and_capture(app);
        }))
        // グローバルホットキー。
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        show_and_capture(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![set_global_shortcut])
        .setup(|app| {
            // 既定ホットキー Alt+Space を登録。
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                let _ = app.global_shortcut().register("Alt+Space");
            }

            // トレイメニュー。
            let show_item = MenuItem::with_id(app, "show", "Wish を開く", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
            let menu = MenuBuilder::new(app).items(&[&show_item, &quit_item]).build()?;

            TrayIconBuilder::with_id("wish-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Wish")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => show_and_capture(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        // ウィンドウを閉じたら終了せずトレイへ。
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Wish");
}
