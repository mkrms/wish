// 日付編集ポップオーバー。クイックチップ＋ミニカレンダー。
// ユーザー要望に対応: 背景クリックで日付を指定せずに閉じられる。
import { useState } from "react";
import { useStore } from "../store";
import { WD, dateOnly, today } from "../lib/date";

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

  const base = today();
  const curDue = task?.due ? dateOnly(task.due) : null;
  const initial = curDue ?? base;
  const [month, setMonth] = useState({ y: initial.getFullYear(), m: initial.getMonth() });

  const first = new Date(month.y, month.m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const cells = [];
  for (let k = 0; k < 42; k++) {
    const dayNum = k - startDow + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const dt = inMonth ? dateOnly(new Date(month.y, month.m, dayNum)) : null;
    const sel = !!(dt && curDue && curDue.getTime() === dt.getTime());
    const isToday = !!(dt && dt.getTime() === base.getTime());
    cells.push(
      <span
        key={k}
        onClick={
          inMonth
            ? (e) => {
                e.stopPropagation();
                pickDay(dt!.toISOString());
              }
            : undefined
        }
        style={{
          textAlign: "center",
          padding: "6px 0",
          fontSize: 12,
          cursor: inMonth ? "pointer" : "default",
          borderRadius: "50%",
          color: !inMonth ? "#dadce0" : sel ? "#fff" : isToday ? "#1a73e8" : "#3c4043",
          background: sel ? "#1a73e8" : "transparent",
          fontWeight: sel || isToday ? 500 : 400,
        }}
      >
        {inMonth ? dayNum : ""}
      </span>
    );
  }
  // 末尾の全て空の週は表示しない。
  while (cells.length > 35) cells.pop();

  const shiftMonth = (d: number) =>
    setMonth((s) => {
      const dt = new Date(s.y, s.m + d, 1);
      return { y: dt.getFullYear(), m: dt.getMonth() };
    });

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
                setDueQuick(q.kind);
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px 8px" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#3c4043" }}>
            {month.y}年 {month.m + 1}月
          </span>
          <span style={{ fontSize: 14, color: "#80868b", display: "flex", gap: 10 }}>
            <span style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); shiftMonth(-1); }}>
              ‹
            </span>
            <span style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); shiftMonth(1); }}>
              ›
            </span>
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
          {WD.map((dd, ii) => (
            <span key={ii} style={{ textAlign: "center", fontSize: 11, color: "#80868b" }}>
              {dd}
            </span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>{cells}</div>
      </div>
    </>
  );
}
