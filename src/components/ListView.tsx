// リストビュー（今日 / 受信トレイ / 完了済み / プロジェクト別）。
import { useStore } from "../store";
import { diffDays, fmtHeaderDate } from "../lib/date";
import { Icon } from "./Icon";
import { TaskRow } from "./TaskRow";

export function ListView() {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const view = useStore((s) => s.view);
  const quickInput = useStore((s) => s.quickInput);
  const setQuickInput = useStore((s) => s.setQuickInput);
  const submitQuick = useStore((s) => s.submitQuick);
  const toggle = useStore((s) => s.toggle);
  const openDetail = useStore((s) => s.openDetail);

  const open = tasks.filter((t) => !t.done && !t.inbox);
  const todayTasks = open.filter((t) => !t.due || diffDays(t.due) <= 3);
  const doneToday = tasks.filter((t) => t.done && t.doneAt && diffDays(t.doneAt) === 0);

  let listTasks = open;
  let listTitle = "今日";
  let listSub = "";
  let listDate = "";
  let focusLabel = "フォーカス";
  let emptyMsg = "";
  const isArchive = view === "archive";

  if (view === "today") {
    listTasks = todayTasks;
    listTitle = "今日";
    listDate = fmtHeaderDate();
    listSub = "残り " + todayTasks.length + "件";
    emptyMsg = "今日のタスクは完了。お疲れさまでした。";
  } else if (view === "inbox") {
    listTasks = tasks.filter((t) => t.inbox && !t.done);
    listTitle = "受信トレイ";
    listSub = listTasks.length + "件";
    listDate = "あとで整理する未仕分けのタスク";
    focusLabel = "未整理";
    emptyMsg = "受信トレイは空です。";
  } else if (view === "archive") {
    listTasks = tasks.filter((t) => t.done);
    listTitle = "完了済み";
    listSub = listTasks.length + "件";
    listDate = "これまで積み上げてきた記録";
    focusLabel = "完了済み";
    emptyMsg = "まだ完了タスクがありません。";
  } else {
    const p = projects.find((x) => x.id === view);
    listTasks = open.filter((t) => t.project === view);
    listTitle = p ? p.name : "";
    listSub = "未対応 " + listTasks.length + "件";
    listDate = "このプロジェクトでの自分の担当";
    emptyMsg = "未対応タスクはありません。";
  }

  const timed = listTasks.filter((t) => t.time);
  const focus = listTasks.filter((t) => !t.time);
  const listEmpty = timed.length + focus.length === 0 && !isArchive;
  const hasDoneToday = view === "today" && doneToday.length > 0;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "34px 32px 90px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 28, fontWeight: 400, color: "#202124", margin: 0, letterSpacing: 0 }}>{listTitle}</h1>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: "#5f6368" }}>{listSub}</div>
      </div>
      <div style={{ fontSize: 13, color: "#5f6368", marginBottom: 22 }}>{listDate}</div>

      {/* quick add */}
      <div
        className="quickadd"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#f1f3f4",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 24,
        }}
      >
        <Icon name="add" size={22} color="#1a73e8" />
        <input
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitQuick();
          }}
          placeholder="タスクを追加  例: 金曜まで 障害報告書 #顧客A !高"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#202124", fontSize: 14 }}
        />
        <span style={{ fontSize: 11, color: "#80868b", border: "1px solid #dadce0", padding: "2px 7px", borderRadius: 5 }}>
          Enter
        </span>
      </div>

      {/* timed */}
      {timed.length > 0 && (
        <>
          <div style={sectionLabel}>時間指定</div>
          {timed.map((t) => (
            <TaskRow key={t.id} task={t} variant="timed" />
          ))}
          <div style={{ height: 18 }} />
        </>
      )}

      {/* focus */}
      {focus.length > 0 && (
        <>
          <div style={sectionLabel}>{focusLabel}</div>
          {focus.map((t) => (
            <TaskRow key={t.id} task={t} variant="focus" />
          ))}
        </>
      )}

      {listEmpty && (
        <div style={{ textAlign: "center", padding: "70px 0", color: "#9aa0a6" }}>
          <Icon name="check_circle" size={46} color="#dadce0" />
          <div style={{ fontSize: 14, marginTop: 12 }}>{emptyMsg}</div>
        </div>
      )}

      {/* done today */}
      {hasDoneToday && (
        <>
          <div style={{ ...sectionLabel, margin: "26px 0 6px" }}>完了 · {doneToday.length}</div>
          {doneToday.map((t) => (
            <div
              key={t.id}
              className="task-row"
              onClick={() => openDetail(t.id)}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 10px", borderRadius: 10, cursor: "pointer" }}
            >
              <Icon
                name="check_circle"
                size={22}
                color="#1e8e3e"
                style={{ flex: "none", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(t.id);
                }}
              />
              <span style={{ fontSize: 14, flex: 1, color: "#80868b", textDecoration: "line-through" }}>{t.title}</span>
              <span style={{ fontSize: 12, color: "#9aa0a6" }}>{t.doneAt ? "完了" : ""}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.6px",
  color: "#80868b",
  textTransform: "uppercase",
  marginBottom: 6,
};
