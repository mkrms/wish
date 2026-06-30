// palette ウィンドウ専用の軽量ルート（#4）。
// 透過・枠なしの小窓いっぱいに CapturePalette のカードだけを描画する。
// main の App とは別 webview のため、データ同期（storage イベント）と
// palette ライフサイクル（blur で hide / focus で open）をここで配線する。
import { useEffect } from "react";
import { useStore } from "./store";
import { CapturePalette } from "./components/CapturePalette";
import { Toast } from "./components/Toast";
import { useCrossWindowSync, usePaletteWindow } from "./tauri";

export default function PaletteApp() {
  const openPalette = useStore((s) => s.openPalette);

  // 2ウィンドウ間のデータ同期 + palette ウィンドウのライフサイクル（blur hide / focus open）。
  useCrossWindowSync();
  usePaletteWindow();

  // 起動時にパレットを開状態にしておく（ウィンドウ自体の可視性は Rust が制御）。
  useEffect(() => {
    openPalette();
  }, [openPalette]);

  // Esc / ⌘S（メモ保存）のキー処理。palette では Esc でウィンドウ自体を hide する。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (e.key === "Escape") {
        e.preventDefault();
        s.closePalette();
        void hidePaletteWindow();
        return;
      }
      if (s.paletteMode === "memo" && (e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        s.saveMemo();
        void hidePaletteWindow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <CapturePalette />
      <Toast />
    </>
  );
}

/** palette ウィンドウを hide する（Tauri 環境のみ）。 */
async function hidePaletteWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().hide();
  } catch (e) {
    console.error("[wish] hide palette failed", e);
  }
}
