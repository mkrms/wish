// 表示用の小さなヘルパー。
import type { Priority, Project } from "../types";

export function priColor(pri: Priority): string {
  return pri === "high" ? "#d93025" : pri === "med" ? "#f9ab00" : "#9aa0a6";
}

export function priText(pri: Priority): string {
  return pri === "high" ? "高" : pri === "med" ? "中" : "低";
}

export function projColor(projects: Project[], id: string | null): string {
  const p = projects.find((x) => x.id === id);
  return p ? p.color : "#9aa0a6";
}

export function projName(projects: Project[], id: string | null): string | null {
  const p = projects.find((x) => x.id === id);
  return p ? p.name : null;
}

/** サイドナビ行のスタイル（active で青ピル）。 */
export function navStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "9px 14px",
    borderRadius: 100,
    cursor: "pointer",
    fontSize: 14,
    marginBottom: 2,
    background: active ? "#e8f0fe" : "transparent",
    color: active ? "#1967d2" : "#444746",
    fontWeight: active ? 500 : 400,
  };
}
