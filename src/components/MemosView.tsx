// メモビュー（#2）。一覧はサマリー表示 → クリックで展開 → 2ペイン（左=本文 / 右=手動一括タスク化）。
// 自動候補抽出はしない（#5 撤去）。右ペインの複数行をまとめて受信トレイへ起こす。
import { useStore } from "../store";
import { fmtMemoDate } from "../lib/date";
import { memoTaskLines } from "../lib/memo";
import { Icon } from "./Icon";

export function MemosView() {
  const memos = useStore((s) => s.memos);
  const expandedMemoId = useStore((s) => s.expandedMemoId);
  const openPalette = useStore((s) => s.openPalette);
  const memoToTask = useStore((s) => s.memoToTask);
  const delMemo = useStore((s) => s.delMemo);
  const expandMemo = useStore((s) => s.expandMemo);

  const expanded = expandedMemoId ? memos.find((m) => m.id === expandedMemoId) ?? null : null;

  return (
    <div style={{ maxWidth: expanded ? 980 : 760, margin: "0 auto", padding: "34px 32px 90px" }}>
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

      {expanded ? (
        <ExpandedMemo memo={expanded} onClose={() => expandMemo(null)} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {memos.map((m) => (
            <div
              key={m.id}
              onClick={() => expandMemo(m.id)}
              style={{
                background: "#fff",
                border: "1px solid #e8eaed",
                borderRadius: 12,
                padding: "16px 18px",
                boxShadow: "0 1px 2px rgba(60,64,67,0.06)",
                cursor: "pointer",
              }}
            >
              {/* サマリー: 先頭数行のみ（line-clamp）。全文は展開時に表示。 */}
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#3c4043",
                  marginBottom: 12,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.text}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid #f1f3f4", paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: "#9aa0a6", flex: 1 }}>{fmtMemoDate(m.createdAt)}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    memoToTask(m.id);
                  }}
                  style={{ fontSize: 12, color: "#1a73e8", cursor: "pointer", fontWeight: 500 }}
                >
                  タスク化
                </span>
                <Icon
                  name="delete"
                  size={18}
                  color="#9aa0a6"
                  className="del-icon"
                  style={{ cursor: "pointer" }}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    delMemo(m.id);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpandedMemo({ memo, onClose }: { memo: { id: string; text: string; createdAt: string }; onClose: () => void }) {
  const memoTaskDraft = useStore((s) => s.memoTaskDraft);
  const setMemoTaskDraft = useStore((s) => s.setMemoTaskDraft);
  const addTasksFromMemo = useStore((s) => s.addTasksFromMemo);
  const delMemo = useStore((s) => s.delMemo);

  const count = memoTaskLines(memoTaskDraft).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            border: "1px solid #dadce0",
            background: "#fff",
            color: "#3c4043",
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <Icon name="arrow_back" size={18} />
          一覧へ戻る
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "#9aa0a6" }}>{fmtMemoDate(memo.createdAt)}</span>
        <Icon
          name="delete"
          size={18}
          color="#9aa0a6"
          className="del-icon"
          style={{ cursor: "pointer" }}
          onClick={() => {
            delMemo(memo.id);
            onClose();
          }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        {/* 左ペイン: メモ本文（読みやすく全文） */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e8eaed",
            borderRadius: 12,
            padding: "20px 22px",
            boxShadow: "0 1px 2px rgba(60,64,67,0.06)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.6px", color: "#5f6368", textTransform: "uppercase", marginBottom: 12 }}>
            メモ本文
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.7, color: "#3c4043", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {memo.text}
          </div>
        </div>

        {/* 右ペイン: このメモから手動でタスクを一括作成 */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e8eaed",
            borderRadius: 12,
            padding: "20px 22px",
            boxShadow: "0 1px 2px rgba(60,64,67,0.06)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.6px", color: "#5f6368", textTransform: "uppercase", marginBottom: 6 }}>
            このメモからタスクを起こす
          </div>
          <div style={{ fontSize: 12, color: "#80868b", marginBottom: 12 }}>
            1行 = 1タスク。<code>明日15時</code> / <code>#プロジェクト</code> / <code>!高</code> も使えます。受信トレイに入ります。
          </div>
          <textarea
            className="input-focus"
            value={memoTaskDraft}
            onChange={(e) => setMemoTaskDraft(e.target.value)}
            placeholder={"例:\n設計レビューの準備 明日\n見積もり修正 #案件A !高"}
            rows={8}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #dadce0",
              borderRadius: 10,
              padding: "12px 14px",
              fontSize: 14,
              lineHeight: 1.6,
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
              marginBottom: 12,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#9aa0a6", flex: 1 }}>{count > 0 ? `${count}件を作成します` : "行を入力してください"}</span>
            <button
              onClick={() => addTasksFromMemo(memo.id)}
              disabled={count === 0}
              style={{
                border: "none",
                background: count === 0 ? "#dadce0" : "#1a73e8",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                padding: "10px 20px",
                borderRadius: 8,
                cursor: count === 0 ? "default" : "pointer",
              }}
            >
              タスクを一括追加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
