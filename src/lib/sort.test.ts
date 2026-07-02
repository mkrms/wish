// sortTasks の純粋関数テスト。入力非変異・安定ソート・期限なし末尾を検証する。
import { describe, it, expect } from "vitest";
import { sortTasks } from "./sort";
import type { Task } from "../types";

function task(id: string, over: Partial<Task> = {}): Task {
  return { id, title: id, project: null, pri: "med", due: null, time: null, done: false, inbox: false, notes: "", ...over };
}

describe("sortTasks", () => {
  it("added: desc は元順（新しい順そのまま）、asc は反転（古い順）", () => {
    const a = task("a");
    const b = task("b");
    const c = task("c");
    expect(sortTasks([a, b, c], "added", "desc").map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(sortTasks([a, b, c], "added", "asc").map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("priority: asc は 高→中→低、同順位は元順序を保つ（安定）", () => {
    const lo = task("lo", { pri: "low" });
    const hi1 = task("hi1", { pri: "high" });
    const me = task("me", { pri: "med" });
    const hi2 = task("hi2", { pri: "high" });
    expect(sortTasks([lo, hi1, me, hi2], "priority", "asc").map((t) => t.id)).toEqual(["hi1", "hi2", "me", "lo"]);
    expect(sortTasks([lo, hi1, me, hi2], "priority", "desc").map((t) => t.id)).toEqual(["lo", "me", "hi1", "hi2"]);
  });

  it("due: asc は期限の近い順、期限なしは方向に関わらず末尾", () => {
    const d1 = task("d1", { due: "2026-07-01T00:00:00.000Z" });
    const d2 = task("d2", { due: "2026-07-10T00:00:00.000Z" });
    const none = task("none");
    expect(sortTasks([d2, none, d1], "due", "asc").map((t) => t.id)).toEqual(["d1", "d2", "none"]);
    // desc でも期限なしは末尾のまま、期限つきは遠い順。
    expect(sortTasks([d1, none, d2], "due", "desc").map((t) => t.id)).toEqual(["d2", "d1", "none"]);
  });

  it("入力配列を変異させない", () => {
    const arr = [task("a", { pri: "low" }), task("b", { pri: "high" })];
    const snapshot = arr.map((t) => t.id);
    sortTasks(arr, "priority", "asc");
    expect(arr.map((t) => t.id)).toEqual(snapshot);
  });
});
