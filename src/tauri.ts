// Tauri 連携（フロント側）。ブラウザでも同じビルドが動くよう、すべて実行時ガードする。
import { useEffect } from "react";
import { useStore } from "./store";

/** Tauri ランタイム上で動作しているか。 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

/**
 * OS グローバルホットキー（既定 Alt+Space）。
 * Rust 側がショートカット登録・ウィンドウ表示/前面化を行い、"toggle-palette" を emit する。
 * フロントはそれを受けてコマンドパレットを開く。
 */
export function useGlobalHotkey(): void {
  const openShortcut = useStore((s) => s.settings.open);

  // Rust が emit する toggle-palette を購読。
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen("toggle-palette", () => {
          useStore.getState().openPalette();
        })
      )
      .then((un) => {
        unlisten = un;
      })
      .catch((e) => console.error("[wish] failed to listen toggle-palette", e));
    return () => unlisten?.();
  }, []);

  // 設定のホットキーが変わったら Rust 側へ再登録を依頼。
  useEffect(() => {
    if (!isTauri()) return;
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke("set_global_shortcut", { accelerator: toAccelerator(openShortcut) }))
      .catch((e) => console.error("[wish] failed to set global shortcut", e));
  }, [openShortcut]);
}

/** 設定表示（"Alt + Space"）を Tauri アクセラレータ（"Alt+Space"）へ変換。 */
function toAccelerator(combo: string): string {
  return combo
    .split("+")
    .map((p) => p.trim())
    .map((p) => (p === "Cmd" ? "Super" : p))
    .join("+");
}
