// 日付編集ポップオーバー。クイックチップ＋ミニカレンダー（MiniCalendar 共用）。
// ユーザー要望に対応: 背景クリックで日付を指定せずに閉じられる。
import { useStore } from "../store";
import { MiniCalendar } from "./MiniCalendar";

const QUICK: { label: string; kind: string }[] = [
  { label: "今日", kind: "today" },
  { label: "明日", kind: "tomorrow" },
  { label: "今週末", kind: "weekend" },
  { label: "金曜", kind: "fri" },
  { label: "来週月", kind: "nextmon" },
  { label: "指定なし", kind: "none" },
];

export function DatePopover({ taskId }: { taskId: string }) {
  const setDueQuick = useStore((s) => s.setDueQuick);
  const pickDay = useStore((s) => s.pickDay);
  const closeDateEditor = useStore((s) => s.closeDateEditor);
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId));

  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation();
          closeDateEditor();
        }}
        style={{ position: "fixed", inset: 0, zIndex: 30 }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          right: 0,
          top: 46,
          width: 272,
          background: "#fff",
          border: "1px solid #e8eaed",
          borderRadius: 12,
          boxShadow: "0 8px 30px rgba(60,64,67,0.22)",
          padding: 14,
          zIndex: 31,
          animation: "pop 0.14s ease",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 14 }}>
          {QUICK.map((q) => (
            <div
              key={q.kind}
              onClick={(e) => {
                e.stopPropagation();
                setDueQuick(q.kind, taskId);
              }}
              style={{
                fontSize: 12,
                textAlign: "center",
                padding: 8,
                borderRadius: 8,
                cursor: "pointer",
                background: "#f1f3f4",
                color: "#3c4043",
              }}
            >
              {q.label}
            </div>
          ))}
        </div>
        <MiniCalendar due={task?.due ?? null} onPick={(iso) => pickDay(iso, taskId)} />
      </div>
    </>
  );
}
