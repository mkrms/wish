// Wish デスクトップシェル（RayCast 風 2ウィンドウ構成）。
// - グローバルホットキー（既定 Alt+Space）で palette ウィンドウを toggle（本体 main は出さない）
// - main: フルUI。起動時は非表示（visible:false）。閉じる(×)はトレイ退避。
// - palette: 枠なし・透過・最前面・skipTaskbar の小窓。ホットキーで toggle、フォーカス喪失で hide。
// - システムトレイ常駐（左クリックで main トグル、メニューから 開く/設定/終了）
// - デスクトップ自動起動（tauri-plugin-autostart, 既定 OFF・OS 側を正）
// - 二重起動を防ぎ、既存の main を前面化
//
// バンドル版クラッシュ対策として unwrap/expect は増やさず、エラーは握って無視する。

use tauri::{
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::ShortcutState;

const MAIN: &str = "main";
const PALETTE: &str = "palette";

/// main（フルUI）を表示・前面化する。palette には触れない（トレイ「Wish を開く」用）。
fn focus_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window(MAIN) {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

/// main の表示/非表示をトグル（トレイ左クリック用）。
fn toggle_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window(MAIN) {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            focus_main(app);
        }
    }
}

/// palette ウィンドウを toggle（#9）。非表示なら show+focus、表示中なら hide。本体 main は出さない。
fn toggle_palette(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window(PALETTE) {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

/// フロントの「フルUIを開く」導線から呼ばれ、main を表示する（palette は webview 側で hide）。
#[tauri::command]
fn show_main(app: tauri::AppHandle) {
    focus_main(&app);
}

/// 設定変更時にフロントから呼ばれ、グローバルホットキーを再登録する。
#[tauri::command]
fn set_global_shortcut(app: tauri::AppHandle, accelerator: String) -> Result<(), String> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    gs.register(accelerator.as_str()).map_err(|e| e.to_string())
}

/// デスクトップ自動起動の有効/無効を切り替える（#8）。結果は握って無視（OS 側が正）。
#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) {
    let mgr = app.autolaunch();
    let _ = if enabled { mgr.enable() } else { mgr.disable() };
}

/// 自動起動の現在状態を返す（#8 起動時同期用）。エラー時は false。
#[tauri::command]
fn get_autostart(app: tauri::AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 二重起動時は既存の main を前面化（palette は出さない）。
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            focus_main(app);
        }))
        // デスクトップ自動起動（既定の引数で可。Windows ではランチャー種別は無視される）。
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        // グローバルホットキー: 押下で palette を toggle（本体は出さない, #9）。
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_palette(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            set_global_shortcut,
            set_autostart,
            get_autostart,
            show_main
        ])
        .setup(|app| {
            // 既定ホットキー Alt+Space を登録。
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                let _ = app.global_shortcut().register("Alt+Space");
            }

            // トレイメニュー（開く / 設定 / 終了）。
            let show_item = MenuItem::with_id(app, "show", "Wish を開く", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "設定", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &settings_item, &quit_item])
                .build()?;

            // アイコンはコンパイル時に埋め込む。default_window_icon() はバンドル版で
            // None を返すことがあり、unwrap すると panic=abort で即クラッシュするため使わない。
            TrayIconBuilder::with_id("wish-tray")
                .icon(tauri::include_image!("icons/32x32.png"))
                .tooltip("Wish")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => focus_main(app),
                    "settings" => {
                        focus_main(app);
                        let _ = app.emit("open-settings", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        toggle_main(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        // ウィンドウを閉じたら終了せずトレイへ（main / palette とも非表示にとどめる）。
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Wish");
}
