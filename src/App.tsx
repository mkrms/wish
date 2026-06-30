import { useEffect } from "react";
import { useStore } from "./store";
import { Sidebar } from "./components/Sidebar";
import { ListView } from "./components/ListView";
import { MemosView } from "./components/MemosView";
import { DashboardView } from "./components/DashboardView";
import { SettingsView } from "./components/SettingsView";
import { TaskDetailSheet } from "./components/TaskDetailSheet";
import { AddProjectDialog } from "./components/AddProjectDialog";
import { CapturePalette } from "./components/CapturePalette";
import { Toast } from "./components/Toast";
import { useGlobalHotkey } from "./tauri";

export default function App() {
  const view = useStore((s) => s.view);
  const detailOpen = useStore((s) => s.detailId !== null);
  const projectDialogOpen = useStore((s) => s.projectDialogOpen);
  const paletteOpen = useStore((s) => s.paletteOpen);

  // OS グローバルホットキー（Tauri 環境でのみ有効）でパレットを開く。
  useGlobalHotkey();

  // アプリ内キーボードショートカット（プロトタイプの onKey を移植）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (s.recording) {
        if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        const parts: string[] = [];
        if (e.ctrlKey) parts.push("Ctrl");
        if (e.metaKey) parts.push("Cmd");
        if (e.altKey) parts.push("Alt");
        if (e.shiftKey) parts.push("Shift");
        let k = e.key;
        if (k === " ") k = "Space";
        else if (k.length === 1) k = k.toUpperCase();
        parts.push(k);
        s.recordHotkey(parts.join(" + "));
        return;
      }
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (s.paletteOpen) s.closePalette();
        else s.openPalette();
        return;
      }
      if (e.key === "Escape") s.escape();
      if (s.paletteOpen && s.paletteMode === "memo" && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        s.convertSelected();
      }
      if (s.paletteOpen && s.paletteMode === "memo" && (e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        s.saveMemo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isMemos = view === "memos";
  const isDashboard = view === "dashboard";
  const isSettings = view === "settings";
  const isList = !isMemos && !isDashboard && !isSettings;

  return (
    <div style={{ height: "100vh", display: "flex", background: "#fff", overflow: "hidden" }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
        {isList && <ListView />}
        {isMemos && <MemosView />}
        {isDashboard && <DashboardView />}
        {isSettings && <SettingsView />}
      </main>

      {detailOpen && <TaskDetailSheet />}
      {projectDialogOpen && <AddProjectDialog />}
      {paletteOpen && <CapturePalette />}
      <Toast />
    </div>
  );
}
