// 初期サンプルデータ。クリーンリリース方針（D-015）により、タスク・メモは空で出荷し、
// プロジェクトはタスク追加先を必ず確保するためのデフォルト1件のみを置く。

import type { Memo, Project, Settings, Task } from "../types";

/** クリーンリリース: デフォルトプロジェクト1件のみ（タスク追加先を確保。D-015）。 */
export function seedProjects(): Project[] {
  return [{ id: "p1", name: "個人", color: "#1a73e8" }];
}

/** クリーンリリース: 初期タスクは置かない（D-015 / D-008）。 */
export function seedTasks(): Task[] {
  return [];
}

/** クリーンリリース: 初期メモは置かない（D-015）。 */
export function seedMemos(): Memo[] {
  return [];
}

export function seedSettings(): Settings {
  return { open: "Alt + Space", add: "Ctrl + K", weekStart: "月", defaultProject: "p1", notifyDue: true, notifyDaily: true };
}

export const SWATCHES = ["#1a73e8", "#1e8e3e", "#f9ab00", "#d93025", "#9334e6", "#12b5cb"];
