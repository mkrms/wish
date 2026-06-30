// store のアクション（#7 renameProject / #2 addTasksFromMemo）のユニットテスト。
// migrateState 以外の store 振る舞いを、zustand store を直接駆動して検証する。
// persist の storage アクセスは node 環境では遅延され import は成立する（store.test.ts と同方針）。

import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./store";
import type { Memo, Project } from "./types";

const baseProjects: Project[] = [
  { id: "p1", name: "個人", color: "#1a73e8" },
  { id: "p2", name: "案件A", color: "#1e8e3e" },
];

function resetStore(over: Partial<ReturnType<typeof useStore.getState>> = {}) {
  useStore.setState({
    tasks: [],
    projects: baseProjects.map((p) => ({ ...p })),
    memos: [],
    seq: 100,
    expandedMemoId: null,
    memoTaskDraft: "",
    toast: null,
    ...over,
  });
}

describe("renameProject（#7）", () => {
  beforeEach(() => resetStore());

  it("該当プロジェクト名を更新する（前後空白はトリム）", () => {
    useStore.getState().renameProject("p2", "  新案件  ");
    const p = useStore.getState().projects.find((x) => x.id === "p2");
    expect(p?.name).toBe("新案件");
    // 他は不変。
    expect(useStore.getState().projects.find((x) => x.id === "p1")?.name).toBe("個人");
  });

  it("空名は無視して名前を変えない（トーストで通知）", () => {
    useStore.getState().renameProject("p1", "   ");
    expect(useStore.getState().projects.find((x) => x.id === "p1")?.name).toBe("個人");
    expect(useStore.getState().toast).toBe("プロジェクト名を入力してください");
  });

  it("存在しない id は何もしない（落ちない）", () => {
    expect(() => useStore.getState().renameProject("zzz", "x")).not.toThrow();
    expect(useStore.getState().projects).toHaveLength(2);
  });
});

describe("addTasksFromMemo（#2 メモ右ペイン一括追加）", () => {
  const memo: Memo = { id: "me1", text: "会議メモ\n発注確認すること", createdAt: "2026-06-01T00:00:00.000Z" };

  beforeEach(() => resetStore({ memos: [memo] }));

  it("ドラフトの各行を受信トレイ（inbox/project=null）へ起こし、元メモ本文を notes に保持する", () => {
    useStore.setState({ memoTaskDraft: "発注確認\n議事録を共有 !高" });
    useStore.getState().addTasksFromMemo("me1");

    const tasks = useStore.getState().tasks;
    expect(tasks).toHaveLength(2);
    // 新しい順に先頭へ積まれる（map 順 = 入力順を先頭側に保持）。
    const titles = tasks.map((t) => t.title);
    expect(titles).toContain("発注確認");
    expect(titles).toContain("議事録を共有");
    for (const t of tasks) {
      expect(t.inbox).toBe(true);
      expect(t.project).toBeNull();
      expect(t.notes).toBe(memo.text);
    }
    // 優先度解析が効く。
    expect(tasks.find((t) => t.title === "議事録を共有")?.pri).toBe("high");
    // ドラフトはクリアされる。
    expect(useStore.getState().memoTaskDraft).toBe("");
    // seq が行数ぶん進む。
    expect(useStore.getState().seq).toBe(102);
  });

  it("空行のみのドラフトはタスクを作らずトースト通知（seq 据え置き）", () => {
    useStore.setState({ memoTaskDraft: "   \n\n" });
    useStore.getState().addTasksFromMemo("me1");
    expect(useStore.getState().tasks).toHaveLength(0);
    expect(useStore.getState().seq).toBe(100);
    expect(useStore.getState().toast).toBe("タスクにする行を入力してください");
  });

  it("存在しないメモ id では何もしない", () => {
    useStore.setState({ memoTaskDraft: "x" });
    useStore.getState().addTasksFromMemo("nope");
    expect(useStore.getState().tasks).toHaveLength(0);
  });
});
