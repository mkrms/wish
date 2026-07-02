// タスク詳細サイドシート（タスクごとのタイトル編集・プロジェクト変更・メモ＋日付編集）。
import { useState } from "react";
import type { CSSProperties } from "react";
import { useStore } from "../store";
import type { Priority } from "../types";
import { fmtDue } from "../lib/date";
import { priColor, priText, projColor } from "../lib/display";
import { Icon } from "./Icon";
import { MiniCalendar } from "./MiniCalendar";

const DATE_CHIPS: { kind: string; label: string }[] = [
  { kind: "today", label: "今日" },
  { kind: "tomorrow", label: "明日" },
  { kind: "weekend", label: "今週末" },
  { kind: "none", label: "なし" },
];

export function TaskDetailSheet() {
  const detailId = useStore((s) => s.detailId);
  const task = useStore((s) => s.tasks.find((t) => t.id === detailId));
  const projects = useStore((s) => s.projects);
  const closeDetail = useStore((s) => s.closeDetail);
  const toggle = useStore((s) => s.toggle);
  const delTask = useStore((s) => s.delTask);
  const setDetailNotes = useStore((s) => s.setDetailNotes);
  const setDueQuick = useStore((s) => s.setDueQuick);
  const pickDay = useStore((s) => s.pickDay);
  const setPriority = useStore((s) => s.setPriority);
  const setTaskProject = useStore((s) => s.setTaskProject);

  if (!task) return null;

  const curLabel = fmtDue(task.due);

  const chipStyle = (kind: string, label: string): CSSProperties => {
    const noneActive = kind === "none" && !task.due;
    const dateActive = (label === "今日" && curLabel === "今日") || (label === "明日" && curLabel === "明日");
    const active = noneActive || dateActive;
    return {
      fontSize: 12,
      padding: "6px 12px",
      borderRadius: 8,
      cursor: "pointer",
      background: active ? "#e8f0fe" : "#f1f3f4",
      color: active ? "#1967d2" : "#3c4043",
    };
  };

  return (
    <>
      <div
        onClick={closeDetail}
        style={{ position: "fixed", inset: 0, background: "rgba(32,33,36,0.32)", zIndex: 40, animation: "fade 0.12s ease" }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: 400,
          maxWidth: "92vw",
          background: "#fff",
          zIndex: 41,
          boxShadow: "-8px 0 30px rgba(60,64,67,0.18)",
          display: "flex",
          flexDirection: "column",
          animation: "slidein 0.2s cubic-bezier(0.2,0,0,1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: "1px solid #e8eaed" }}>
          <Icon
            name={task.done ? "check_circle" : "radio_button_unchecked"}
            size={24}
            color={task.done ? "#1e8e3e" : "#bdc1c6"}
            style={{ cursor: "pointer" }}
            onClick={() => toggle(task.id)}
          />
          <div style={{ flex: 1 }} />
          <Icon
            name="close"
            size={22}
            color="#5f6368"
            className="icon-btn"
            style={{ cursor: "pointer", padding: 6, borderRadius: "50%" }}
            onClick={closeDetail}
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
          {/* key で remount し、別タスクへ切替時にタイトルの下書き state をリセットする。 */}
          <TitleEdit key={task.id} id={task.id} initial={task.title} />

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Icon name="folder" size={20} color="#5f6368" />
              <span style={{ width: 11, height: 11, borderRadius: 4, background: projColor(projects, task.project), flex: "none" }} />
              <select
                value={task.project ?? ""}
                onChange={(e) => setTaskProject(task.id, e.target.value === "" ? null : e.target.value)}
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: "#3c4043",
                  border: "1px solid #dadce0",
                  borderRadius: 8,
                  padding: "6px 10px",
                  background: "#fff",
                  outline: "none",
                }}
              >
                <option value="">受信トレイ（未仕分け）</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Icon name="flag" size={20} color="#5f6368" />
              <div style={{ display: "flex", gap: 6 }}>
                {(["high", "med", "low"] as Priority[]).map((pri) => {
                  const active = task.pri === pri;
                  return (
                    <span
                      key={pri}
                      onClick={() => setPriority(task.id, pri)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 500,
                        padding: "6px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "1px solid " + (active ? priColor(pri) : "#dadce0"),
                        color: active ? "#fff" : "#5f6368",
                        background: active ? priColor(pri) : "#fff",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: active ? "#fff" : priColor(pri),
                        }}
                      />
                      {priText(pri)}
                    </span>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Icon name="event" size={20} color="#5f6368" />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {DATE_CHIPS.map((c) => (
                  <span key={c.kind} onClick={() => setDueQuick(c.kind, task.id)} style={chipStyle(c.kind, c.label)}>
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
            {/* カレンダーで任意日を指定（クイックチップの下、アイコン幅ぶん字下げ） */}
            <div style={{ paddingLeft: 34, maxWidth: 320 }}>
              <MiniCalendar due={task.due} onPick={(iso) => pickDay(iso, task.id)} />
            </div>
          </div>

          {/* memo */}
          <div style={subHead}>メモ</div>
          <textarea
            className="input-focus"
            value={task.notes}
            onChange={(e) => setDetailNotes(e.target.value)}
            placeholder="このタスクのメモ・調査内容・決定事項を書く…"
            style={{
              width: "100%",
              minHeight: 130,
              border: "1px solid #dadce0",
              borderRadius: 10,
              padding: "12px 14px",
              fontSize: 14,
              lineHeight: 1.6,
              color: "#3c4043",
              outline: "none",
            }}
          />
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid #e8eaed", display: "flex", gap: 10 }}>
          <button
            onClick={() => toggle(task.id)}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              background: task.done ? "#f1f3f4" : "#1a73e8",
              color: task.done ? "#3c4043" : "#fff",
            }}
          >
            {task.done ? "未完了に戻す" : "完了にする"}
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="danger-btn"
            onClick={() => delTask(task.id)}
            style={{ border: "none", background: "transparent", color: "#5f6368", fontSize: 13, cursor: "pointer", padding: "9px 12px", borderRadius: 8 }}
          >
            削除
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * タイトルのインライン編集。ProjectHeader の名前編集と同じ作法:
 * Enter / blur で確定、Esc で取り消し、空・無変更は元に戻す。
 */
function TitleEdit({ id, initial }: { id: string; initial: string }) {
  const renameTask = useStore((s) => s.renameTask);
  const [title, setTitle] = useState(initial);

  const commit = () => {
    const next = title.trim();
    if (!next || next === initial) {
      setTitle(initial);
      return;
    }
    renameTask(id, next);
  };

  return (
    <input
      className="input-focus"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        else if (e.key === "Escape") {
          setTitle(initial);
          (e.target as HTMLInputElement).blur();
        }
      }}
      style={{
        width: "100%",
        boxSizing: "border-box",
        fontSize: 20,
        fontWeight: 400,
        lineHeight: 1.4,
        color: "#202124",
        marginBottom: 18,
        border: "1px solid transparent",
        borderRadius: 8,
        padding: "4px 8px",
        outline: "none",
        background: "transparent",
      }}
    />
  );
}

const subHead: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.4px",
  color: "#5f6368",
  textTransform: "uppercase",
  marginBottom: 8,
};
