// Tauri 連携（フロント側）。ブラウザでも同じビルドが動くよう、すべて実行時ガードする。
import { useEffect } from "react";
import { useStore } from "./store";

/** Tauri ランタイム上で動作しているか。 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

/**
 * 現在の Tauri ウィンドウ label を返す（同期取得）。Tauri 非環境では null。
 * 2ウィンドウ構成（main / palette）で、同一バンドルの描画を出し分けるために使う。
 * `getCurrentWindow()` は内部状態から label を返すため副作用なく同期で取れる。
 */
export function currentWindowLabel(): string | null {
  if (!isTauri()) return null;
  try {
    // __TAURI_INTERNALS__.metadata に現在ウィンドウの label が入る。
    const internals = (window as unknown as { __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } } })
      .__TAURI_INTERNALS__;
    const label = internals?.metadata?.currentWindow?.label;
    return typeof label === "string" ? label : null;
  } catch {
    return null;
  }
}

/** palette ウィンドウとして動作しているか。 */
export function isPaletteWindow(): boolean {
  return currentWindowLabel() === "palette";
}

/**
 * OS グローバルホットキー（既定 Alt+Space）。
 * Rust 側が palette ウィンドウの show/hide toggle を担う（#9）。
 * フロント（main）は廃止された "toggle-palette" を購読する必要はないが、
 * ブラウザ（Tauri 非環境）では従来どおりオーバーレイをトグルするため購読を残す。
 * 設定のホットキー変更時は Rust へ再登録を依頼する（#9 維持）。
 */
export function useGlobalHotkey(): void {
  const openShortcut = useStore((s) => s.settings.open);

  // ブラウザ用フォールバック: Rust が無いので toggle-palette emit は来ない。
  // （Tauri 環境では Rust がウィンドウ show/hide を行うため、ここでの購読は不要。）
  // 設定のホットキーが変わったら Rust 側へ再登録を依頼。
  useEffect(() => {
    if (!isTauri()) return;
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke("set_global_shortcut", { accelerator: toAccelerator(openShortcut) }))
      .catch((e) => console.error("[wish] failed to set global shortcut", e));
  }, [openShortcut]);
}

/**
 * トレイ「設定」から emit される open-settings を購読し、設定ビューへ遷移する（#11）。
 * main ウィンドウでのみ意味を持つ（palette には設定ビューが無い）。
 */
export function useTrayEvents(): void {
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen("open-settings", () => {
          useStore.getState().nav("settings");
        })
      )
      .then((un) => {
        unlisten = un;
      })
      .catch((e) => console.error("[wish] failed to listen open-settings", e));
    return () => unlisten?.();
  }, []);
}

/**
 * 2ウィンドウ間のデータ同期（#4 / D-011）。
 * palette と main は別 webview ＝ zustand persist が別インスタンスのため、
 * 一方の localStorage 変更を他方が `storage` イベントで受けて rehydrate する。
 * `storage` イベントは同一ドキュメントの変更では発火しないため、自ウィンドウの
 * 変更で多重 rehydrate されることはない。
 */
export function useCrossWindowSync(): void {
  useEffect(() => {
    if (!isTauri()) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== "wish-store") return;
      // 他ウィンドウが localStorage を更新 → persist を読み直して状態を合わせる。
      void useStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}

/**
 * 起動時に OS の自動起動状態（is_enabled）を settings へ同期する（#8 / OS 側が正）。
 * ブラウザでは no-op。
 */
export function useAutostartSync(): void {
  useEffect(() => {
    if (!isTauri()) return;
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke<boolean>("get_autostart"))
      .then((enabled) => {
        if (typeof enabled === "boolean") useStore.getState().setAutostart(enabled);
      })
      .catch((e) => console.error("[wish] failed to sync autostart", e));
  }, []);
}

/**
 * palette ウィンドウ専用のライフサイクル配線（#4 / #9）。
 * - フォーカス喪失（blur）で自動 hide（D-011）。
 * - 表示時（focus）にキャプチャ入力へフォーカスが当たるよう openPalette を呼ぶ。
 * - Esc は App 側の onKey で closePalette → ここで hide につなぐ。
 */
export function usePaletteWindow(): void {
  useEffect(() => {
    if (!isPaletteWindow()) return;
    let unlistenFocus: (() => void) | undefined;
    let cancelled = false;

    import("@tauri-apps/api/window")
      .then(async ({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        // フォーカス変化を購読: 失ったら hide、得たらパレットを開いた状態にする。
        const un = await win.onFocusChanged(({ payload: focused }) => {
          if (focused) {
            // 表示されたら入力可能な状態へ（CapturePalette が描画される）。
            useStore.getState().openPalette();
          } else {
            // フォーカス喪失で自動 hide（RayCast 流, D-011）。
            void win.hide();
          }
        });
        if (cancelled) un();
        else unlistenFocus = un;
      })
      .catch((e) => console.error("[wish] palette window wiring failed", e));

    return () => {
      cancelled = true;
      unlistenFocus?.();
    };
  }, []);
}

/** 設定表示（"Alt + Space"）を Tauri アクセラレータ（"Alt+Space"）へ変換。 */
function toAccelerator(combo: string): string {
  return combo
    .split("+")
    .map((p) => p.trim())
    .map((p) => (p === "Cmd" ? "Super" : p))
    .join("+");
}
