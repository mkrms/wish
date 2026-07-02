// タスク並び替えの純粋ロジック（描画・store から分離）。安定ソート・入力非変異。
import type { SortDir, SortKey, Task } from "../types";
import { dateOnly } from "./date";

/** 優先度の並び順ランク（小さいほど上位）。 */
const PRI_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };

/**
 * タスク配列を並び替える。元配列は変異させずコピーを返す。
 * - "added": 元の順序（新規が先頭＝新しい順）。desc=そのまま / asc=古い順（反転）。
 * - "priority": 高→中→低（asc 既定）。dir で反転。同順位は元順序を保つ（安定）。
 * - "due": 期限の近い順（asc 既定）。dir で反転。**期限なしは方向に関わらず常に末尾**。同値は元順序。
 */
export function sortTasks(tasks: Task[], key: SortKey, dir: SortDir): Task[] {
  const arr = tasks.slice();
  if (key === "added") {
    return dir === "desc" ? arr : arr.reverse();
  }

  const sign = dir === "asc" ? 1 : -1;
  const indexed = arr.map((t, i) => ({ t, i }));

  if (key === "priority") {
    indexed.sort((a, b) => {
      const d = (PRI_RANK[a.t.pri] - PRI_RANK[b.t.pri]) * sign;
      return d !== 0 ? d : a.i - b.i;
    });
    return indexed.map((x) => x.t);
  }

  // key === "due"
  indexed.sort((a, b) => {
    const ad = a.t.due;
    const bd = b.t.due;
    // 期限なしは常に末尾（両方なしは元順序）。
    if (!ad && !bd) return a.i - b.i;
    if (!ad) return 1;
    if (!bd) return -1;
    const d = (dateOnly(ad).getTime() - dateOnly(bd).getTime()) * sign;
    return d !== 0 ? d : a.i - b.i;
  });
  return indexed.map((x) => x.t);
}
