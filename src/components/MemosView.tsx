// メモビュー（#2）。一覧はサマリー表示 → クリックで展開 → 2ペイン（左=本文 / 右=手動一括タスク化）。
// 自動候補抽出はしない（#5 撤去）。右ペインの複数行をまとめて受信トレイへ起こす。
import type { CSSProperties } from "react";
import { useStore } from "../store";
import { fmtMemoDate, fmtDue } from "../lib/date";
import { priColor, priText, projColor, projName } from "../lib/display";
import type { Priority } from "../types";
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

/** クイック日付チップ（kind は store.setDueQuick と揃える。"none" は日付なし）。 */
const FORM_DATE_CHIPS: { kind: string; label: string }[] = [
  { kind: "none", label: "なし" },
  { kind: "today", label: "今日" },
  { kind: "tomorrow", label: "明日" },
  { kind: "weekend", label: "今週末" },
];

/** kind → due ISO（store.setDueQuick と同じ写像を、フォーム用にローカルで持つ）。 */
function dueFromKind(kind: string): string | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const add = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d.toISOString();
  };
  const nextWd = (wd: number) => {
    const d = new Date(now);
    const diff = (wd - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString();
  };
  if (kind === "today") return now.toISOString();
  if (kind === "tomorrow") return add(1);
  if (kind === "weekend") return nextWd(6);
  return null;
}

function ExpandedMemo({ memo, onClose }: { memo: { id: string; text: string; createdAt: string }; onClose: () => void }) {
  const projects = useStore((s) => s.projects);
  const memoForm = useStore((s) => s.memoForm);
  const memoPending = useStore((s) => s.memoPending);
  const setMemoForm = useStore((s) => s.setMemoForm);
  const addPendingTask = useStore((s) => s.addPendingTask);
  const removePendingTask = useStore((s) => s.removePendingTask);
  const commitPendingTasks = useStore((s) => s.commitPendingTasks);
  const editMemo = useStore((s) => s.editMemo);
  const delMemo = useStore((s) => s.delMemo);

  const count = memoPending.length;
  // 現在のフォームで選択中の日付チップ（due の有無で判定。具体一致は label でゆるく）。
  const curDue = fmtDue(memoForm.due);
  const chipActive = (kind: string) => {
    if (kind === "none") return !memoForm.due;
    if (kind === "today") return curDue === "今日";
    if (kind === "tomorrow") return curDue === "明日";
    if (kind === "weekend" && memoForm.due) return curDue !== "今日" && curDue !== "明日";
    return false;
  };

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
          <div style={paneLabel}>メモ本文</div>
          <textarea
            className="input-focus"
            value={memo.text}
            onChange={(e) => editMemo(memo.id, e.target.value)}
            placeholder="メモを編集…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              minHeight: 320,
              resize: "vertical",
              border: "1px solid #dadce0",
              borderRadius: 10,
              padding: "12px 14px",
              fontSize: 15,
              lineHeight: 1.7,
              color: "#3c4043",
              outline: "none",
            }}
          />
        </div>

        {/* 右ペイン: 構造化フォーム → 保留リスト → 一括登録 */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e8eaed",
            borderRadius: 12,
            padding: "20px 22px",
            boxShadow: "0 1px 2px rgba(60,64,67,0.06)",
          }}
        >
          <div style={paneLabel}>このメモからタスクを起こす</div>

          {/* 1. 入力フォーム */}
          <input
            className="input-focus"
            value={memoForm.title}
            onChange={(e) => setMemoForm({ title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") addPendingTask();
            }}
            placeholder="タスク名（例: 設計レビューの準備）"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #dadce0",
              borderRadius: 10,
              padding: "11px 14px",
              fontSize: 14,
              outline: "none",
              marginBottom: 12,
            }}
          />

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {/* プロジェクト */}
            <div style={{ flex: 1 }}>
              <div style={fieldLabel}>プロジェクト</div>
              <select
                value={memoForm.project ?? ""}
                onChange={(e) => setMemoForm({ project: e.target.value === "" ? null : e.target.value })}
                style={selectStyle}
              >
                <option value="">受信トレイ（未仕分け）</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {/* 優先度 */}
            <div style={{ flex: "none" }}>
              <div style={fieldLabel}>優先度</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["high", "med", "low"] as Priority[]).map((pri) => (
                  <span
                    key={pri}
                    onClick={() => setMemoForm({ pri })}
                    style={priChipStyle(memoForm.pri === pri, pri)}
                  >
                    {priText(pri)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 日付 */}
          <div style={fieldLabel}>日付</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {FORM_DATE_CHIPS.map((c) => (
              <span
                key={c.kind}
                onClick={() => setMemoForm({ due: dueFromKind(c.kind) })}
                style={dateChipStyle(chipActive(c.kind))}
              >
                {c.label}
              </span>
            ))}
            <input
              type="date"
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return setMemoForm({ due: null });
                const d = new Date(v + "T00:00:00");
                setMemoForm({ due: d.toISOString() });
              }}
              style={{ ...selectStyle, padding: "5px 8px", width: 140 }}
            />
          </div>

          {/* 2. 「リストに追加」 */}
          <button
            onClick={addPendingTask}
            disabled={!memoForm.title.trim()}
            style={{
              width: "100%",
              border: "1px solid #1a73e8",
              background: memoForm.title.trim() ? "#e8f0fe" : "#f1f3f4",
              color: memoForm.title.trim() ? "#1967d2" : "#9aa0a6",
              fontSize: 14,
              fontWeight: 500,
              padding: "10px",
              borderRadius: 8,
              cursor: memoForm.title.trim() ? "pointer" : "default",
              marginBottom: 18,
            }}
          >
            ＋ リストに追加
          </button>

          {/* 3. 保留リスト */}
          <div style={{ ...fieldLabel, marginBottom: 8 }}>登録待ち {count > 0 ? `(${count})` : ""}</div>
          {count === 0 ? (
            <div style={{ fontSize: 13, color: "#9aa0a6", padding: "10px 0 16px" }}>
              タスクを入力して「リストに追加」を押すと、ここに溜まります。
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {memoPending.map((p) => (
                <div
                  key={p.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#f8f9fa",
                    border: "1px solid #e8eaed",
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: priColor(p.pri), flex: "none" }} />
                  <span style={{ fontSize: 14, color: "#202124", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#5f6368", flex: "none" }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: projColor(projects, p.project) }} />
                    {projName(projects, p.project) ?? "受信トレイ"}
                  </span>
                  {p.due && <span style={{ fontSize: 12, color: "#5f6368", flex: "none" }}>{fmtDue(p.due)}{p.time ? " " + p.time : ""}</span>}
                  <Icon
                    name="close"
                    size={16}
                    color="#9aa0a6"
                    className="del-icon"
                    style={{ cursor: "pointer", flex: "none" }}
                    onClick={() => removePendingTask(p.key)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* 4. 「N件を一括登録」 */}
          <button
            onClick={() => commitPendingTasks(memo.id)}
            disabled={count === 0}
            style={{
              width: "100%",
              border: "none",
              background: count === 0 ? "#dadce0" : "#1a73e8",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              padding: "11px",
              borderRadius: 8,
              cursor: count === 0 ? "default" : "pointer",
            }}
          >
            {count > 0 ? `${count}件を一括登録` : "一括登録"}
          </button>
        </div>
      </div>
    </div>
  );
}

const paneLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.6px",
  color: "#5f6368",
  textTransform: "uppercase",
  marginBottom: 14,
};

const fieldLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "#80868b",
  marginBottom: 6,
};

const selectStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: 13,
  border: "1px solid #dadce0",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#202124",
  background: "#fff",
  outline: "none",
};

function priChipStyle(active: boolean, pri: Priority): CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 500,
    padding: "7px 11px",
    borderRadius: 8,
    cursor: "pointer",
    border: "1px solid " + (active ? priColor(pri) : "#dadce0"),
    color: active ? "#fff" : "#5f6368",
    background: active ? priColor(pri) : "#fff",
  };
}

function dateChipStyle(active: boolean): CSSProperties {
  return {
    fontSize: 12,
    padding: "7px 12px",
    borderRadius: 8,
    cursor: "pointer",
    background: active ? "#e8f0fe" : "#f1f3f4",
    color: active ? "#1967d2" : "#3c4043",
  };
}
