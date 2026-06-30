// 完了タスク履歴からダッシュボードの各指標を導出する純粋関数群（D-007）。
//
// 共通規約:
// - 「完了」の判定は `t.done === true` かつ `t.doneAt` が有効な日付であること。
//   `done` でも `doneAt` が null/undefined の場合は集計から除外する。
// - 基準時刻 `now` は既定で `today()`（実時刻の 0:00）。すべての関数が `now` を
//   引数で受け取り、内部で `new Date()` を直接呼ばない（再現性・決定性のため）。
// - 日別集計は `diffDays(doneAt, now)` で行い、`0`=今日 / `-1`=昨日 / … とする。
//   未来完了（`diffDays > 0`）は窓に含めない。
//
// D-005 厳守: 完了率・進捗率・フェーズに相当する値（done/total 比など）は一切
// 算出・公開しない。各関数は「件数」「件数配列」「経過日数」「真偽」のみ返す。

import type { Task, TaskType } from "../types";
import { diffDays, today } from "./date";

/** 種別の全キー（0件でも必ず揃えるための基準）。 */
const TASK_TYPES: TaskType[] = ["設計", "開発", "DOC", "MTG"];

/** 完了タスク（`done && doneAt` が有効）のみを抽出する。 */
function completedTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.done && !!t.doneAt);
}

/**
 * 完了タスクの「今日からのオフセット日数」配列（`diffDays(doneAt, now)`）。
 * 未来完了（> 0）は除外する。
 */
function completedOffsets(tasks: Task[], now: Date): number[] {
  return completedTasks(tasks)
    .map((t) => diffDays(t.doneAt as string, now))
    .filter((d) => d <= 0);
}

/** 連続記録（直近で完了タスクがある日が何日連続しているか）。grace 仕様。 */
export function computeStreak(tasks: Task[], now: Date = today()): number {
  const days = new Set(completedOffsets(tasks, now));
  // 起点の決定（grace）: 今日完了があれば 0、無くても昨日完了があれば -1、
  // どちらも無ければ継続は途切れているので 0。
  let start: number;
  if (days.has(0)) start = 0;
  else if (days.has(-1)) start = -1;
  else return 0;

  let count = 0;
  let d = start;
  while (days.has(d)) {
    count++;
    d--;
  }
  return count;
}

/** 直近 n 日（now を含む n 日窓 = オフセット `-(n-1) 〜 0`）に完了したタスク件数。 */
export function completedInLastNDays(tasks: Task[], n: number, now: Date = today()): number {
  return completedOffsets(tasks, now).filter((d) => d <= 0 && d >= -(n - 1)).length;
}

/** 直近 n 日窓の件数と、その直前の同じ長さ n 日窓の件数、増減率（%）。 */
export function periodComparison(
  tasks: Task[],
  n: number,
  now: Date = today()
): { current: number; previous: number; deltaPct: number | null } {
  const offsets = completedOffsets(tasks, now);
  const current = offsets.filter((d) => d <= 0 && d >= -(n - 1)).length;
  // 直前の窓: オフセット `-2n+1 〜 -n`。
  const previous = offsets.filter((d) => d <= -n && d >= -(2 * n - 1)).length;
  const deltaPct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  return { current, previous, deltaPct };
}

/** 直近 days 日（既定 42）の日別完了件数（古い→新しいの配列、長さ = days）。 */
export function heatmap(tasks: Task[], days = 42, now: Date = today()): number[] {
  // index 0 = (days-1) 日前、末尾 = 今日（オフセット 0）。
  const counts = new Array<number>(days).fill(0);
  for (const d of completedOffsets(tasks, now)) {
    // d は 0（今日）〜 負（過去）。配列添字は `days - 1 + d`。
    const idx = days - 1 + d;
    if (idx >= 0 && idx < days) counts[idx]++;
  }
  return counts;
}

/** 完了タスクの種別ごと件数。既定は直近 14 日窓の完了タスクが母集合。 */
export function typeBreakdown(
  tasks: Task[],
  opts: { days?: number; now?: Date } = {}
): Record<TaskType, number> {
  const days = opts.days ?? 14;
  const now = opts.now ?? today();
  const result = {} as Record<TaskType, number>;
  for (const k of TASK_TYPES) result[k] = 0;
  for (const t of completedTasks(tasks)) {
    const d = diffDays(t.doneAt as string, now);
    if (d <= 0 && d >= -(days - 1)) {
      result[t.type]++;
    }
  }
  return result;
}

/** あるプロジェクトの流量。bars=直近 weeks 週の週次完了数、recent=直近 recentDays 日の完了件数。 */
export function projectFlow(
  tasks: Task[],
  projectId: string,
  opts: { weeks?: number; recentDays?: number; now?: Date } = {}
): { bars: number[]; recent: number } {
  const weeks = opts.weeks ?? 8;
  const recentDays = opts.recentDays ?? 14;
  const now = opts.now ?? today();
  const bars = new Array<number>(weeks).fill(0);
  let recent = 0;
  for (const t of completedTasks(tasks)) {
    if (t.project !== projectId) continue;
    const off = diffDays(t.doneAt as string, now);
    if (off > 0) continue; // 未来完了は除外
    const d = Math.abs(off);
    if (d <= recentDays - 1) recent++;
    const week = Math.floor(d / 7);
    if (week < weeks) bars[weeks - 1 - week]++;
  }
  return { bars, recent };
}

/** あるプロジェクトの停滞判定（最終完了からの経過日数としきい値。既定 14 日）。 */
export function projectStale(
  tasks: Task[],
  projectId: string,
  opts: { thresholdDays?: number; now?: Date } = {}
): { stale: boolean; staleDays: number } {
  const thresholdDays = opts.thresholdDays ?? 14;
  const now = opts.now ?? today();
  let minAbs: number | null = null;
  for (const t of completedTasks(tasks)) {
    if (t.project !== projectId) continue;
    const off = diffDays(t.doneAt as string, now);
    if (off > 0) continue; // 未来完了は除外
    const abs = Math.abs(off);
    if (minAbs === null || abs < minAbs) minAbs = abs;
  }
  // 完了履歴ゼロのプロジェクト（追加直後を含む）は { stale:false, staleDays:0 }。
  if (minAbs === null) return { stale: false, staleDays: 0 };
  return { stale: minAbs >= thresholdDays, staleDays: minAbs };
}

/** 1プロジェクト分の派生メトリクス（保存しない計算値）。 */
export interface ProjectMetrics {
  /** 直近8週の週次完了数（古い→新しい、長さ 8）。 */
  bars: number[];
  /** 直近14日の完了件数。 */
  recent: number;
  /** 棚卸し推奨フラグ（最終完了から 14 日以上で true）。 */
  stale: boolean;
  /** 最終完了からの経過日数（完了履歴ゼロなら 0）。 */
  staleDays: number;
}

/** 上記を束ねた1プロジェクト分の派生メトリクス（描画都合のまとめ）。 */
export function projectMetrics(
  tasks: Task[],
  projectId: string,
  opts: { now?: Date } = {}
): ProjectMetrics {
  const now = opts.now ?? today();
  const flow = projectFlow(tasks, projectId, { now });
  const stale = projectStale(tasks, projectId, { now });
  return { bars: flow.bars, recent: flow.recent, stale: stale.stale, staleDays: stale.staleDays };
}
