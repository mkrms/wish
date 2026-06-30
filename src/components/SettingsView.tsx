// 設定（ホットキー / 一般 / 通知）。
import type { CSSProperties } from "react";
import { useStore } from "../store";

const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #e8eaed",
  borderRadius: 14,
  overflow: "hidden",
  marginBottom: 18,
};
const cardHead: CSSProperties = {
  padding: "16px 20px",
  borderBottom: "1px solid #f1f3f4",
  fontSize: 15,
  fontWeight: 500,
};
const row: CSSProperties = { display: "flex", alignItems: "center", padding: "16px 20px" };
const rowB: CSSProperties = { ...row, borderBottom: "1px solid #f1f3f4" };

function hkStyle(active: boolean): CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 500,
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
    border: "1px solid " + (active ? "#1a73e8" : "#dadce0"),
    color: active ? "#1a73e8" : "#3c4043",
    background: active ? "#e8f0fe" : "#fff",
    minWidth: 130,
    textAlign: "center",
  };
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 36,
        height: 14,
        borderRadius: 7,
        cursor: "pointer",
        position: "relative",
        flex: "none",
        transition: "background .15s",
        background: on ? "#aecbfa" : "#bdc1c6",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          boxShadow: "0 1px 3px rgba(60,64,67,0.4)",
          transition: "all .15s",
          background: on ? "#1a73e8" : "#fff",
          left: on ? 18 : -2,
        }}
      />
    </div>
  );
}

const selectStyle: CSSProperties = {
  fontSize: 14,
  border: "1px solid #dadce0",
  borderRadius: 8,
  padding: "8px 12px",
  color: "#202124",
  background: "#fff",
  outline: "none",
};

export function SettingsView() {
  const settings = useStore((s) => s.settings);
  const projects = useStore((s) => s.projects);
  const recording = useStore((s) => s.recording);
  const startRecording = useStore((s) => s.startRecording);
  const setWeekStart = useStore((s) => s.setWeekStart);
  const setDefaultProject = useStore((s) => s.setDefaultProject);
  const toggleNotifyDue = useStore((s) => s.toggleNotifyDue);
  const toggleNotifyDaily = useStore((s) => s.toggleNotifyDaily);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "34px 32px 90px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 22px" }}>設定</h1>

      {/* ホットキー */}
      <div style={card}>
        <div style={cardHead}>ホットキー</div>
        <div style={rowB}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: "#202124" }}>クイック起動 / 追加・メモ</div>
            <div style={{ fontSize: 12, color: "#80868b", marginTop: 2 }}>どの画面からでもWishを呼び出す</div>
          </div>
          <div onClick={() => startRecording("open")} style={hkStyle(recording === "open")}>
            {recording === "open" ? "キーを押す…" : settings.open}
          </div>
        </div>
        <div style={row}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: "#202124" }}>アプリ内コマンドパレット</div>
            <div style={{ fontSize: 12, color: "#80868b", marginTop: 2 }}>Wishにフォーカス中の追加ショートカット</div>
          </div>
          <div onClick={() => startRecording("add")} style={hkStyle(recording === "add")}>
            {recording === "add" ? "キーを押す…" : settings.add}
          </div>
        </div>
      </div>

      {/* 一般 */}
      <div style={card}>
        <div style={cardHead}>一般</div>
        <div style={rowB}>
          <div style={{ flex: 1, fontSize: 14 }}>週の開始曜日</div>
          <select value={settings.weekStart} onChange={(e) => setWeekStart(e.target.value as "月" | "日")} style={selectStyle}>
            <option value="月">月曜</option>
            <option value="日">日曜</option>
          </select>
        </div>
        <div style={row}>
          <div style={{ flex: 1, fontSize: 14 }}>追加時のデフォルトプロジェクト</div>
          <select value={settings.defaultProject} onChange={(e) => setDefaultProject(e.target.value)} style={selectStyle}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 通知 */}
      <div style={{ ...card, marginBottom: 0 }}>
        <div style={cardHead}>通知</div>
        <div style={rowB}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14 }}>締切リマインド</div>
            <div style={{ fontSize: 12, color: "#80868b", marginTop: 2 }}>期限が近いタスクを知らせる</div>
          </div>
          <Switch on={settings.notifyDue} onClick={toggleNotifyDue} />
        </div>
        <div style={row}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14 }}>デイリーサマリー</div>
            <div style={{ fontSize: 12, color: "#80868b", marginTop: 2 }}>毎朝、今日のタスクをまとめて表示</div>
          </div>
          <Switch on={settings.notifyDaily} onClick={toggleNotifyDaily} />
        </div>
      </div>
    </div>
  );
}
