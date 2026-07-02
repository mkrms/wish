// 左ナビ（Material/Workspace 風ピルナビ）。
import { useStore } from "../store";
import { diffDays, endOfWeek, today } from "../lib/date";
import { completedInLastNDays, computeStreak } from "../lib/metrics";
import { navStyle } from "../lib/display";
import { Icon } from "./Icon";

export function Sidebar() {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const memos = useStore((s) => s.memos);
  const view = useStore((s) => s.view);
  const weekStart = useStore((s) => s.settings.weekStart);
  const nav = useStore((s) => s.nav);
  const openPalette = useStore((s) => s.openPalette);
  const openProjectDialog = useStore((s) => s.openProjectDialog);

  const now = today();
  const open = tasks.filter((t) => !t.done && !t.inbox);
  // 「タスク」ビューの表示件数と一致させる: 期限なし + 今週末（weekStart 基準）までの期限つき。
  const eowDays = diffDays(endOfWeek(weekStart, now), now);
  const todayCount = open.filter((t) => !t.due || diffDays(t.due, now) <= eowDays).length;
  const inboxCount = tasks.filter((t) => t.inbox && !t.done).length;
  const doneTodayCount = completedInLastNDays(tasks, 1, now);
  const streak = computeStreak(tasks, now);

  const navRow = (id: string, icon: string, label: string, count?: number) => (
    <div className="nav-item" onClick={() => nav(id)} style={navStyle(view === id)}>
      <Icon name={icon} />
      <span style={{ flex: 1 }}>{label}</span>
      {count !== undefined && <span style={{ fontSize: 13, color: "#5f6368" }}>{count}</span>}
    </div>
  );

  return (
    <aside
      style={{
        width: 260,
        flex: "none",
        borderRight: "1px solid #e8eaed",
        display: "flex",
        flexDirection: "column",
        padding: "14px 12px",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 10px 14px" }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: "#1a73e8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 17,
          }}
        >
          W
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, color: "#3c4043", letterSpacing: "0.2px" }}>Wish</div>
      </div>

      <button
        className="fab"
        onClick={() => openPalette()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "auto",
          alignSelf: "flex-start",
          border: "none",
          background: "#c2e7ff",
          color: "#001d35",
          borderRadius: 16,
          padding: "14px 22px 14px 16px",
          cursor: "pointer",
          margin: "4px 4px 16px",
          boxShadow: "0 1px 2px rgba(60,64,67,0.1)",
        }}
      >
        <Icon name="add" size={22} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>追加・メモ</span>
      </button>

      {navRow("today", "wb_sunny", "タスク", todayCount)}
      {navRow("inbox", "inbox", "受信トレイ", inboxCount)}
      {navRow("memos", "sticky_note_2", "メモ", memos.length)}
      {navRow("dashboard", "insights", "ダッシュボード")}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 14px 6px" }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.8px", color: "#5f6368", textTransform: "uppercase" }}>
          プロジェクト
        </span>
        <Icon
          name="add"
          size={18}
          color="#5f6368"
          className="proj-add"
          style={{ cursor: "pointer", padding: 4, borderRadius: "50%" }}
          onClick={() => openProjectDialog()}
        />
      </div>
      {projects.map((p) => (
        <div className="nav-item" key={p.id} onClick={() => nav(p.id)} style={navStyle(view === p.id)}>
          <span style={{ width: 12, height: 12, borderRadius: 4, background: p.color, flex: "none" }} />
          <span style={{ flex: 1 }}>{p.name}</span>
          <span style={{ fontSize: 13, color: "#5f6368" }}>{open.filter((t) => t.project === p.id).length}</span>
        </div>
      ))}

      <div style={{ flex: 1 }} />
      {navRow("archive", "task_alt", "完了済み")}
      {navRow("settings", "settings", "設定")}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "11px 14px",
          marginTop: 6,
          borderTop: "1px solid #e8eaed",
        }}
      >
        <Icon name="local_fire_department" color="#f9ab00" />
        <span style={{ fontSize: 13, color: "#5f6368", flex: 1 }}>
          連続 <b style={{ color: "#1a73e8", fontWeight: 500 }}>{streak}</b> 日
        </span>
        <span style={{ fontSize: 12, color: "#80868b" }}>今日 +{doneTodayCount}</span>
      </div>
    </aside>
  );
}
