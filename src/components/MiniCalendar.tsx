// 月送り付きのミニカレンダー（日付ピッカー）。DatePopover とタスク詳細シートで共用する。
// 選択中の due をハイライトし、日クリックで onPick(iso) を呼ぶ純粋な表示部品。
import { useState } from "react";
import type { CSSProperties } from "react";
import { WD, dateOnly, today } from "../lib/date";

// 月送り矢印。クリック領域を広げてタップしやすくする（丸ボタン、hover は .icon-btn）。
const arrowStyle: CSSProperties = {
  cursor: "pointer",
  fontSize: 20,
  lineHeight: 1,
  minWidth: 30,
  height: 30,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  userSelect: "none",
};

export function MiniCalendar({ due, onPick }: { due: string | null; onPick: (iso: string) => void }) {
  const base = today();
  const curDue = due ? dateOnly(due) : null;
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
                onPick(dt!.toISOString());
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
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px 8px" }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#3c4043" }}>
          {month.y}年 {month.m + 1}月
        </span>
        <span style={{ color: "#5f6368", display: "flex", gap: 4 }}>
          <span
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); shiftMonth(-1); }}
            style={arrowStyle}
          >
            ‹
          </span>
          <span
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); shiftMonth(1); }}
            style={arrowStyle}
          >
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
  );
}
