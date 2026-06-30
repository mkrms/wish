// metrics.ts のユニットテスト。
// 一次ソースは .claude/spec/feature/dashboard.md の受け入れ条件 AC-1〜AC-32。
// 各 it() の冒頭コメントに対応する AC 番号を明記する。
//
// 時刻は固定 `NOW` を全関数へ注入し、`doneAt` は `addDays(-k, NOW)` の ISO で与えて
// 決定論的にする（内部 `new Date()` 依存を排除）。

import { describe, it, expect } from "vitest";
import {
  computeStreak,
  completedInLastNDays,
  periodComparison,
  heatmap,
  projectFlow,
  projectStale,
  projectMetrics,
} from "./metrics";
import { addDays } from "./date";
import type { Task } from "../types";

// 固定基準時刻（0:00 正規化済み）。曜日・月跨ぎの揺れを避けるため平日かつ月中を選ぶ。
const NOW = new Date(2026, 5, 30); // 2026-06-30 ローカル 0:00

let seq = 0;
/**
 * テスト用タスク生成ヘルパ。
 * - `daysAgo` を指定すると `done:true` かつ `doneAt = addDays(-daysAgo, NOW)` の完了タスクになる。
 * - `daysAgo=null` かつ `done` 未指定なら未完了タスク。
 */
function makeTask(opts: {
  daysAgo?: number | null;
  done?: boolean;
  doneAt?: string | null;
  project?: string | null;
}): Task {
  const { daysAgo = null, project = "p1" } = opts;
  let done: boolean;
  let doneAt: string | null;
  if (opts.doneAt !== undefined) {
    // doneAt を明示指定（null 含む）したケース。done は指定値（既定 true）。
    doneAt = opts.doneAt;
    done = opts.done ?? true;
  } else if (daysAgo !== null) {
    doneAt = addDays(-daysAgo, NOW).toISOString();
    done = opts.done ?? true;
  } else {
    doneAt = null;
    done = opts.done ?? false;
  }
  return {
    id: `t${seq++}`,
    title: "task",
    project,
    pri: "med",
    due: null,
    time: null,
    done,
    doneAt,
    inbox: false,
    notes: "",
  };
}

/** daysAgo 完了の完了タスク（簡略ヘルパ）。 */
function done(daysAgo: number, extra: Partial<Parameters<typeof makeTask>[0]> = {}): Task {
  return makeTask({ daysAgo, ...extra });
}

describe("computeStreak", () => {
  it("AC-1: 今日・昨日・一昨日に各1件完了 → 3", () => {
    const tasks = [done(0), done(1), done(2)];
    expect(computeStreak(tasks, NOW)).toBe(3);
  });

  it("AC-2: 今日・昨日完了、3日前無し、4日前あり → 2（途切れたら止まる）", () => {
    const tasks = [done(0), done(1), done(4)];
    expect(computeStreak(tasks, NOW)).toBe(2);
  });

  it("AC-3: 同日複数完了（今日2件・昨日1件）→ 2（同日は1日扱い）", () => {
    const tasks = [done(0), done(0), done(1)];
    expect(computeStreak(tasks, NOW)).toBe(2);
  });

  it("AC-4: 完了タスクが空 → 0", () => {
    const tasks: Task[] = [makeTask({ daysAgo: null })];
    expect(computeStreak(tasks, NOW)).toBe(0);
  });

  it("AC-5: grace・当日未完了。昨日・一昨日・3日前完了（今日/4日前無し）→ 3", () => {
    const tasks = [done(1), done(2), done(3)];
    expect(computeStreak(tasks, NOW)).toBe(3);
  });

  it("AC-5b: grace・2日空き。今日も昨日も無く一昨日以前のみ完了 → 0", () => {
    const tasks = [done(2), done(3), done(4)];
    expect(computeStreak(tasks, NOW)).toBe(0);
  });

  it("AC-5c: 当日完了で +1。昨日・一昨日・今日完了 → 3", () => {
    const tasks = [done(1), done(2), done(0)];
    expect(computeStreak(tasks, NOW)).toBe(3);
  });

  it("AC-6: done:true だが doneAt=null は streak に寄与しない", () => {
    // 今日の完了は doneAt=null なので除外され、昨日・一昨日のみ有効 → grace で 2。
    const tasks = [makeTask({ doneAt: null, done: true }), done(1), done(2)];
    expect(computeStreak(tasks, NOW)).toBe(2);
  });
});

describe("completedInLastNDays", () => {
  it("AC-7: n=14。窓内(0〜13日前)5件・窓外(14日前以前)3件 → 5", () => {
    const tasks = [
      done(0),
      done(3),
      done(7),
      done(10),
      done(13),
      done(14),
      done(20),
      done(40),
    ];
    expect(completedInLastNDays(tasks, 14, NOW)).toBe(5);
  });

  it("AC-8: 境界。13日前は窓内、14日前は窓外", () => {
    expect(completedInLastNDays([done(13)], 14, NOW)).toBe(1);
    expect(completedInLastNDays([done(14)], 14, NOW)).toBe(0);
  });
});

describe("periodComparison", () => {
  it("AC-9: current=10 / previous=8 → deltaPct=25", () => {
    const current = Array.from({ length: 10 }, () => done(0)); // 全部今日（窓内）
    const previous = Array.from({ length: 8 }, () => done(14)); // 全部14日前（直前窓 -14〜-27）
    const r = periodComparison([...current, ...previous], 14, NOW);
    expect(r.current).toBe(10);
    expect(r.previous).toBe(8);
    expect(r.deltaPct).toBe(25);
  });

  it("AC-10: previous=0 → deltaPct=null", () => {
    const r = periodComparison([done(0), done(0)], 14, NOW);
    expect(r.current).toBe(2);
    expect(r.previous).toBe(0);
    expect(r.deltaPct).toBeNull();
  });

  it("AC-11: current=0 / previous=4 → deltaPct=-100", () => {
    const previous = Array.from({ length: 4 }, () => done(14));
    const r = periodComparison(previous, 14, NOW);
    expect(r.current).toBe(0);
    expect(r.previous).toBe(4);
    expect(r.deltaPct).toBe(-100);
  });
});

describe("heatmap", () => {
  it("AC-12: 既定(days=42)で配列長は常に 42", () => {
    expect(heatmap([], 42, NOW)).toHaveLength(42);
    expect(heatmap([done(0)], 42, NOW)).toHaveLength(42);
    // 既定引数でも 42。
    expect(heatmap([], undefined, NOW)).toHaveLength(42);
  });

  it("AC-13: 各要素は当該日の完了件数（整数）。完了無しの日は 0", () => {
    const hm = heatmap([done(0), done(0), done(5)], 42, NOW);
    expect(hm[41]).toBe(2); // 今日に2件
    expect(hm[36]).toBe(1); // 5日前に1件 (42-1-5)
    expect(hm[40]).toBe(0); // 1日前は0件
    expect(hm.every((n) => Number.isInteger(n))).toBe(true);
  });

  it("AC-14: 末尾=今日(0)、先頭=41日前（古い→新しい）", () => {
    const hm = heatmap([done(0), done(41)], 42, NOW);
    expect(hm[41]).toBe(1); // 末尾 = 今日
    expect(hm[0]).toBe(1); // 先頭 = 41日前
  });

  it("AC-15: 42日前以前の完了は配列に含まれない", () => {
    const hm = heatmap([done(42), done(50)], 42, NOW);
    expect(hm.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("projectFlow", () => {
  it("AC-20: recent は対象プロジェクトの直近14日完了。他プロジェクトは数えない", () => {
    const tasks = [
      done(0, { project: "p1" }),
      done(13, { project: "p1" }),
      done(0, { project: "p2" }),
      done(20, { project: "p1" }), // 窓外
    ];
    const r = projectFlow(tasks, "p1", { now: NOW });
    expect(r.recent).toBe(2);
  });

  it("AC-21: bars の長さは常に 8", () => {
    expect(projectFlow([], "p1", { now: NOW }).bars).toHaveLength(8);
    expect(projectFlow([done(0)], "p1", { now: NOW }).bars).toHaveLength(8);
  });

  it("AC-22: 完了無しプロジェクト → recent=0、bars 全要素 0（長さ8）", () => {
    const r = projectFlow([done(0, { project: "other" })], "p1", { now: NOW });
    expect(r.recent).toBe(0);
    expect(r.bars).toHaveLength(8);
    expect(r.bars).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("AC-23: 今日(0)の完了は最新週 = 末尾 bars[7]", () => {
    const r = projectFlow([done(0, { project: "p1" })], "p1", { now: NOW });
    expect(r.bars[7]).toBe(1);
    expect(r.bars.slice(0, 7)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("AC-23b: d=7 → week=1 → bars[6]、d=6 → week=0 → bars[7]、56日前以前(week>=8)除外", () => {
    const r = projectFlow(
      [
        done(7, { project: "p1" }), // week=1 → bars[6]
        done(6, { project: "p1" }), // week=0 → bars[7]
        done(56, { project: "p1" }), // week=8 → 除外
      ],
      "p1",
      { now: NOW }
    );
    expect(r.bars[6]).toBe(1);
    expect(r.bars[7]).toBe(1);
    expect(r.bars.reduce((a, b) => a + b, 0)).toBe(2); // 56日前は含まれない
  });
});

describe("projectStale", () => {
  it("AC-24: 最終完了3日前、既定14 → {stale:false, staleDays:3}", () => {
    const r = projectStale([done(3, { project: "p1" }), done(10, { project: "p1" })], "p1", {
      now: NOW,
    });
    expect(r).toEqual({ stale: false, staleDays: 3 });
  });

  it("AC-25: 最終完了20日前、既定14 → {stale:true, staleDays:20}", () => {
    const r = projectStale([done(20, { project: "p1" }), done(30, { project: "p1" })], "p1", {
      now: NOW,
    });
    expect(r).toEqual({ stale: true, staleDays: 20 });
  });

  it("AC-26: 完了履歴ゼロのプロジェクト → {stale:false, staleDays:0}", () => {
    const r = projectStale([done(0, { project: "other" })], "p1", { now: NOW });
    expect(r).toEqual({ stale: false, staleDays: 0 });
  });

  it("AC-27: しきい値ちょうど(14日)→ stale:true（>= 判定）", () => {
    const r = projectStale([done(14, { project: "p1" })], "p1", { now: NOW });
    expect(r).toEqual({ stale: true, staleDays: 14 });
  });

  it("AC-28: 他プロジェクトの完了は staleDays に影響しない", () => {
    const tasks = [
      done(2, { project: "other" }), // p1 から見れば無関係（より新しいが別案件）
      done(20, { project: "p1" }),
    ];
    const r = projectStale(tasks, "p1", { now: NOW });
    expect(r).toEqual({ stale: true, staleDays: 20 });
  });
});

describe("全体・回帰", () => {
  it("AC-29: 完了率・進捗率・フェーズ相当の公開関数/値が存在しない", async () => {
    const mod = await import("./metrics");
    const exportedNames = Object.keys(mod);
    // 公開シンボルは仕様の関数群 + ProjectMetrics 型（型は実行時に現れない）。
    const allowed = [
      "computeStreak",
      "completedInLastNDays",
      "periodComparison",
      "heatmap",
      "projectFlow",
      "projectStale",
      "projectMetrics",
    ];
    // 想定外の公開シンボルが無いこと（完了率系の漏れ防止）。
    expect(exportedNames.sort()).toEqual([...allowed].sort());
    // 名前に完了率/進捗/フェーズ系の語を含む公開シンボルが無いこと（機械的チェック）。
    const banned = /(rate|ratio|percent|progress|phase|完了率|進捗|フェーズ)/i;
    expect(exportedNames.some((n) => banned.test(n))).toBe(false);
  });

  it("AC-30: 同じ tasks/now を渡せば毎回同じ結果（決定的）", () => {
    const tasks = [
      done(0, { project: "p1" }),
      done(3, { project: "p1" }),
      done(20, { project: "p2" }),
    ];
    expect(computeStreak(tasks, NOW)).toBe(computeStreak(tasks, NOW));
    expect(completedInLastNDays(tasks, 14, NOW)).toBe(completedInLastNDays(tasks, 14, NOW));
    expect(periodComparison(tasks, 14, NOW)).toEqual(periodComparison(tasks, 14, NOW));
    expect(heatmap(tasks, 42, NOW)).toEqual(heatmap(tasks, 42, NOW));
    expect(projectFlow(tasks, "p1", { now: NOW })).toEqual(projectFlow(tasks, "p1", { now: NOW }));
    expect(projectStale(tasks, "p1", { now: NOW })).toEqual(projectStale(tasks, "p1", { now: NOW }));
    expect(projectMetrics(tasks, "p1", { now: NOW })).toEqual(
      projectMetrics(tasks, "p1", { now: NOW })
    );
  });
});

describe("projectMetrics（束ね・補助）", () => {
  it("projectFlow と projectStale の結果を束ねて返す", () => {
    const tasks = [
      done(0, { project: "p1" }),
      done(6, { project: "p1" }),
      done(20, { project: "p2" }),
    ];
    const flow = projectFlow(tasks, "p1", { now: NOW });
    const stale = projectStale(tasks, "p1", { now: NOW });
    const m = projectMetrics(tasks, "p1", { now: NOW });
    expect(m).toEqual({
      bars: flow.bars,
      recent: flow.recent,
      stale: stale.stale,
      staleDays: stale.staleDays,
    });
  });
});
