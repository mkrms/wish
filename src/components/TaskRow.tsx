// タスク1行（時間指定／フォーカス共通）。
import { useStore } from "../store";
import type { Task } from "../types";
import { dueColor, fmtDue } from "../lib/date";
import { doneSubLabel, priColor, projColor } from "../lib/display";
import { Icon } from "./Icon";
import { DatePopover } from "./DatePopover";

export function TaskRow({ task, variant }: { task: Task; variant: "timed" | "focus" }) {
  const projects = useStore((s) => s.projects);
  const editingDateId = useStore((s) => s.editingDateId);
  const toggle = useStore((s) => s.toggle);
  const openDetail = useStore((s) => s.openDetail);
  const openDate = useStore((s) => s.openDate);

  const hasNote = !!(task.notes && task.notes.trim());
  const dueLabel = task.done ? null : fmtDue(task.due) || "＋日付";

  return (
    <div style={{ position: "relative" }}>
      <div
        className="task-row"
        onClick={() => openDetail(task.id)}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 10px", borderRadius: 10, cursor: "pointer" }}
      >
        <Icon
          name="radio_button_unchecked"
          size={22}
          color="#bdc1c6"
          className="chk"
          style={{ flex: "none", cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            toggle(task.id);
          }}
        />

        {variant === "timed" ? (
          <span style={{ fontSize: 13, color: "#1a73e8", fontWeight: 500, flex: "none", width: 42 }}>{task.time}</span>
        ) : (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: priColor(task.pri), flex: "none" }} />
        )}

        <span style={{ fontSize: 14, flex: 1, color: "#202124" }}>
          {task.title}
          {variant === "focus" && task.sub.length > 0 && (
            <span style={{ fontSize: 12, color: "#80868b", marginLeft: 8 }}>{doneSubLabel(task)}</span>
          )}
        </span>

        {hasNote && <Icon name="notes" size={16} color="#9aa0a6" />}

        <span style={{ fontSize: 11, color: "#5f6368", background: "#f1f3f4", padding: "3px 9px", borderRadius: 6, flex: "none" }}>
          {task.type}
        </span>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: projColor(projects, task.project), flex: "none" }} />

        <span
          className="due"
          onClick={(e) => {
            e.stopPropagation();
            openDate(task.id);
          }}
          style={{
            fontSize: 11,
            cursor: "pointer",
            padding: "4px 9px",
            borderRadius: 7,
            flex: "none",
            fontWeight: 500,
            color: task.due ? dueColor(task.due) : "#9aa0a6",
            background: task.due ? "#f1f3f4" : undefined,
            border: task.due ? undefined : "1px dashed #dadce0",
          }}
        >
          {dueLabel}
        </span>
      </div>
      {editingDateId === task.id && <DatePopover taskId={task.id} />}
    </div>
  );
}
