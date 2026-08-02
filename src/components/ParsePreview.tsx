// 入力の解析プレビュー（「解析 → [日付][プロジェクト][優先度]」のチップ）。
// パレットとクイック追加で共用する（D-031 で ListView にも表示するため切り出した）。

import type { CSSProperties } from "react";
import { useStore } from "../store";
import { fmtDue } from "../lib/date";
import { priText } from "../lib/display";
import { parse } from "../lib/parse";
import { Icon } from "./Icon";

const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  background: "#f1f3f4",
  padding: "5px 11px",
  borderRadius: 8,
};

export function ParsePreview({ input, style }: { input: string; style?: CSSProperties }) {
  const projects = useStore((s) => s.projects);
  const pp = parse(input || "", projects);
  const proj = pp.project ? projects.find((x) => x.id === pp.project) : null;

  const dateLabel = ((pp.due ? fmtDue(pp.due) : "") + (pp.time ? " " + pp.time : "")).trim();
  const priColor = pp.pri === "high" ? "#d93025" : pp.pri === "med" ? "#f9ab00" : "#9aa0a6";

  // 何も解釈されていないときは出さない（入力の邪魔をしない）。
  if (!dateLabel && !proj && !pp.pri) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", ...style }}>
      <div style={{ fontSize: 12, color: "#80868b", marginRight: 2 }}>解析 →</div>
      {dateLabel && (
        <span style={{ ...chip, background: "#e8f0fe", color: "#1967d2" }}>
          <Icon name="event" size={15} />
          {dateLabel}
        </span>
      )}
      {proj && (
        <span style={chip}>
          <span style={{ width: 8, height: 8, borderRadius: 3, background: proj.color }} />
          {proj.name}
        </span>
      )}
      {pp.pri && (
        <span style={chip}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: priColor }} />
          優先度 {priText(pp.pri)}
        </span>
      )}
    </div>
  );
}
