// コマンドパレット（追加・メモ）。タスクモードは自然言語解析、メモモードは本文保存のみ。
import type { CSSProperties } from "react";
import { useStore } from "../store";
import { fmtDue } from "../lib/date";
import { priText } from "../lib/display";
import { parse } from "../lib/parse";
import { Icon } from "./Icon";

export function CapturePalette() {
  const mode = useStore((s) => s.paletteMode);
  const projects = useStore((s) => s.projects);
  const paletteInput = useStore((s) => s.paletteInput);
  const paletteProjectId = useStore((s) => s.paletteProjectId);
  const memoText = useStore((s) => s.memoText);
  const closePalette = useStore((s) => s.closePalette);
  const setMode = useStore((s) => s.setMode);
  const setPaletteInput = useStore((s) => s.setPaletteInput);
  const setPaletteProjectId = useStore((s) => s.setPaletteProjectId);
  const submitPaletteTask = useStore((s) => s.submitPaletteTask);
  const setMemoText = useStore((s) => s.setMemoText);
  const saveMemo = useStore((s) => s.saveMemo);

  // 解析プレビュー
  const pp = parse(paletteInput || "", projects);
  const parsedProj = pp.project ? projects.find((x) => x.id === pp.project) : null;
  const parsed = {
    show: !!(paletteInput && paletteInput.trim()),
    hasDate: !!(pp.due || pp.time),
    dateLabel: ((pp.due ? fmtDue(pp.due) : "") + (pp.time ? " " + pp.time : "")).trim() || pp.time || "",
    hasProject: !!parsedProj,
    projName: parsedProj ? parsedProj.name : "",
    projColor: parsedProj ? parsedProj.color : "#1a73e8",
    hasPriority: !!pp.pri,
    priText: pp.pri ? priText(pp.pri) : "",
    priColor: pp.pri === "high" ? "#d93025" : pp.pri === "med" ? "#f9ab00" : "#9aa0a6",
  };

  const tabStyle = (active: boolean): CSSProperties => ({
    fontSize: 13,
    padding: "7px 16px",
    borderRadius: 6,
    cursor: "pointer",
    background: active ? "#fff" : "transparent",
    color: active ? "#1967d2" : "#5f6368",
    fontWeight: active ? 500 : 400,
    boxShadow: active ? "0 1px 2px rgba(60,64,67,0.15)" : undefined,
  });

  return (
    <div
      onClick={closePalette}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(32,33,36,0.4)",
        zIndex: 50,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        animation: "fade 0.12s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          marginTop: 72,
          width: 640,
          maxWidth: "92vw",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(60,64,67,0.3)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "pop 0.16s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid #f1f3f4" }}>
          <div style={{ display: "flex", background: "#f1f3f4", borderRadius: 8, padding: 3 }}>
            <div onClick={() => setMode("task")} style={tabStyle(mode === "task")}>
              タスク
            </div>
            <div onClick={() => setMode("memo")} style={tabStyle(mode === "memo")}>
              メモ
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <select
            value={paletteProjectId}
            onChange={(e) => setPaletteProjectId(e.target.value)}
            style={{ fontSize: 13, background: "#fff", border: "1px solid #dadce0", color: "#3c4043", padding: "7px 11px", borderRadius: 8, outline: "none" }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {mode === "task" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px" }}>
              <Icon name="bolt" size={24} color="#1a73e8" />
              <input
                value={paletteInput}
                onChange={(e) => setPaletteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitPaletteTask(e.shiftKey);
                }}
                placeholder="明日15時 設計レビュー #ECサイト !高"
                autoFocus
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#202124", fontSize: 18 }}
              />
            </div>
            {parsed.show && (
              <div style={{ padding: "0 20px 14px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 12, color: "#80868b", marginRight: 2 }}>解析 →</div>
                {parsed.hasDate && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, background: "#e8f0fe", color: "#1967d2", padding: "5px 11px", borderRadius: 8 }}>
                    <Icon name="event" size={15} />
                    {parsed.dateLabel}
                  </span>
                )}
                {parsed.hasProject && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, background: "#f1f3f4", padding: "5px 11px", borderRadius: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 3, background: parsed.projColor }} />
                    {parsed.projName}
                  </span>
                )}
                {parsed.hasPriority && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, background: "#f1f3f4", padding: "5px 11px", borderRadius: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: parsed.priColor }} />
                    優先度 {parsed.priText}
                  </span>
                )}
              </div>
            )}
            <div style={footer}>
              <span onClick={() => submitPaletteTask(false)} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#1a73e8", cursor: "pointer", fontWeight: 500 }}>
                <span style={{ background: "#e8f0fe", padding: "2px 7px", borderRadius: 5 }}>Enter</span> タスクを追加
              </span>
              <span>
                <b style={{ color: "#5f6368", fontWeight: 500 }}>Shift+Enter</b> 受信トレイへ
              </span>
              <div style={{ flex: 1 }} />
              <span>
                <b style={{ color: "#5f6368", fontWeight: 500 }}>Esc</b> 閉じる
              </span>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: "16px 18px 6px" }}>
              <textarea
                className="memo-ta"
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                placeholder={"会議や設計のメモをそのまま流し込む…\n・決定事項、論点、TODO を混在でOK\n・⌘S で記録として保存"}
                autoFocus
                style={{
                  width: "100%",
                  height: 180,
                  background: "#f8f9fa",
                  border: "1px solid #e8eaed",
                  borderRadius: 10,
                  color: "#3c4043",
                  fontSize: 14,
                  lineHeight: 1.7,
                  padding: "12px 14px",
                  outline: "none",
                }}
              />
            </div>
            <div style={footer}>
              <span onClick={() => saveMemo()} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#1a73e8", cursor: "pointer", fontWeight: 500 }}>
                <span style={{ background: "#e8f0fe", padding: "2px 7px", borderRadius: 5 }}>⌘S</span> メモとして保存
              </span>
              <div style={{ flex: 1 }} />
              <span>
                <b style={{ color: "#5f6368", fontWeight: 500 }}>Esc</b> 閉じる
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const footer: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  padding: "12px 20px",
  borderTop: "1px solid #f1f3f4",
  fontSize: 12,
  color: "#80868b",
};
