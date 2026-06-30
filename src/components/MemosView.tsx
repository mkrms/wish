// メモビュー（単独メモの一覧）。
import { useStore } from "../store";
import { fmtMemoDate } from "../lib/date";
import { Icon } from "./Icon";

export function MemosView() {
  const memos = useStore((s) => s.memos);
  const openPalette = useStore((s) => s.openPalette);
  const memoToTask = useStore((s) => s.memoToTask);
  const delMemo = useStore((s) => s.delMemo);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "34px 32px 90px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 28, fontWeight: 400, margin: 0 }}>メモ</h1>
        <div style={{ flex: 1 }} />
        <button
          className="ghost-btn"
          onClick={() => openPalette("memo")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid #dadce0",
            background: "#fff",
            color: "#1a73e8",
            borderRadius: 8,
            padding: "9px 16px",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <Icon name="add" size={18} />
          新規メモ
        </button>
      </div>
      <div style={{ fontSize: 13, color: "#5f6368", marginBottom: 22 }}>タスクにしなくていい、ただの記録もここに</div>

      {memos.length === 0 && (
        <div style={{ textAlign: "center", padding: "70px 0", color: "#9aa0a6" }}>
          <Icon name="sticky_note_2" size={46} color="#dadce0" />
          <div style={{ fontSize: 14, marginTop: 12 }}>まだメモはありません</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {memos.map((m) => (
          <div
            key={m.id}
            style={{
              background: "#fff",
              border: "1px solid #e8eaed",
              borderRadius: 12,
              padding: "16px 18px",
              boxShadow: "0 1px 2px rgba(60,64,67,0.06)",
            }}
          >
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "#3c4043", whiteSpace: "pre-wrap", marginBottom: 12 }}>
              {m.text}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid #f1f3f4", paddingTop: 10 }}>
              <span style={{ fontSize: 12, color: "#9aa0a6", flex: 1 }}>{fmtMemoDate(m.createdAt)}</span>
              <span onClick={() => memoToTask(m.id)} style={{ fontSize: 12, color: "#1a73e8", cursor: "pointer", fontWeight: 500 }}>
                タスク化
              </span>
              <Icon name="delete" size={18} color="#9aa0a6" className="del-icon" style={{ cursor: "pointer" }} onClick={() => delMemo(m.id)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
