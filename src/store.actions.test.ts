// store のアクション（#7 renameProject / C メモ構造化登録 / B プロジェクト編集 / D 優先度）のユニットテスト。
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
    memoForm: { title: "", project: null, pri: "med", due: null },
    memoPending: [],
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

describe("メモ構造化一括登録（C: フォーム → 保留リスト → 一括登録）", () => {
  const memo: Memo = { id: "me1", text: "会議メモ\n発注確認すること", createdAt: "2026-06-01T00:00:00.000Z" };

  beforeEach(() => resetStore({ memos: [memo] }));

  it("addPendingTask: フォームを保留リストへ積み、フォームをクリアし、seq を 1 進める", () => {
    useStore.setState({ memoForm: { title: "発注確認", project: "p2", pri: "high", due: null } });
    useStore.getState().addPendingTask();

    const pending = useStore.getState().memoPending;
    expect(pending).toHaveLength(1);
    expect(pending[0].title).toBe("発注確認");
    expect(pending[0].project).toBe("p2");
    expect(pending[0].pri).toBe("high");
    // フォームはクリアされる。
    expect(useStore.getState().memoForm.title).toBe("");
    // seq は 1 進む（保留 key 発番分）。
    expect(useStore.getState().seq).toBe(101);
    // まだ tasks は増えない。
    expect(useStore.getState().tasks).toHaveLength(0);
  });

  it("addPendingTask: タイトル空は積まずトースト通知（保留・seq 据え置き）", () => {
    useStore.setState({ memoForm: { title: "   ", project: null, pri: "med", due: null } });
    useStore.getState().addPendingTask();
    expect(useStore.getState().memoPending).toHaveLength(0);
    expect(useStore.getState().seq).toBe(100);
    expect(useStore.getState().toast).toBe("タスク名を入力してください");
  });

  it("removePendingTask: 指定 key を保留リストから取り除く", () => {
    useStore.setState({ memoForm: { title: "A", project: null, pri: "med", due: null } });
    useStore.getState().addPendingTask();
    const key = useStore.getState().memoPending[0].key;
    useStore.getState().removePendingTask(key);
    expect(useStore.getState().memoPending).toHaveLength(0);
  });

  it("commitPendingTasks: 保留全件を実タスク化し、元メモ本文を notes に保持・リストをクリア", () => {
    // 1件目: 受信トレイ（未仕分け）/ 2件目: プロジェクト指定。
    useStore.setState({ memoForm: { title: "発注確認", project: null, pri: "med", due: null } });
    useStore.getState().addPendingTask();
    useStore.setState({ memoForm: { title: "議事録を共有", project: "p2", pri: "high", due: null } });
    useStore.getState().addPendingTask();

    useStore.getState().commitPendingTasks("me1");

    const tasks = useStore.getState().tasks;
    expect(tasks).toHaveLength(2);
    const titles = tasks.map((t) => t.title);
    expect(titles).toContain("発注確認");
    expect(titles).toContain("議事録を共有");
    // 元メモ本文を notes に保持。
    for (const t of tasks) expect(t.notes).toBe(memo.text);
    // 受信トレイ（project=null）は inbox=true、プロジェクト指定は inbox=false。
    const inboxTask = tasks.find((t) => t.title === "発注確認")!;
    const projTask = tasks.find((t) => t.title === "議事録を共有")!;
    expect(inboxTask.project).toBeNull();
    expect(inboxTask.inbox).toBe(true);
    expect(projTask.project).toBe("p2");
    expect(projTask.inbox).toBe(false);
    expect(projTask.pri).toBe("high");
    // 登録後、保留リストはクリアされる。
    expect(useStore.getState().memoPending).toHaveLength(0);
  });

  it("commitPendingTasks: 保留が空ならタスクを作らずトースト通知", () => {
    useStore.getState().commitPendingTasks("me1");
    expect(useStore.getState().tasks).toHaveLength(0);
    expect(useStore.getState().toast).toBe("リストにタスクを追加してください");
  });

  it("commitPendingTasks: 存在しないメモ id では何もしない", () => {
    useStore.setState({ memoForm: { title: "x", project: null, pri: "med", due: null } });
    useStore.getState().addPendingTask();
    useStore.getState().commitPendingTasks("nope");
    expect(useStore.getState().tasks).toHaveLength(0);
  });
});

describe("プロジェクト編集（B: setProjectColor / delProject）", () => {
  beforeEach(() => resetStore());

  it("setProjectColor: 該当プロジェクトの色を変える（他は不変）", () => {
    useStore.getState().setProjectColor("p2", "#d93025");
    expect(useStore.getState().projects.find((x) => x.id === "p2")?.color).toBe("#d93025");
    expect(useStore.getState().projects.find((x) => x.id === "p1")?.color).toBe("#1a73e8");
  });

  it("delProject: プロジェクトを消し、所属タスクを受信トレイ（project=null/inbox=true）へ退避", () => {
    useStore.setState({
      tasks: [
        { id: "n1", title: "未完了", project: "p2", pri: "med", due: null, time: null, done: false, inbox: false, notes: "" },
        { id: "n2", title: "完了済み", project: "p2", pri: "med", due: null, time: null, done: true, doneAt: "x", inbox: false, notes: "" },
        { id: "n3", title: "別案件", project: "p1", pri: "med", due: null, time: null, done: false, inbox: false, notes: "" },
      ],
      view: "p2",
    });
    useStore.getState().delProject("p2");

    const s = useStore.getState();
    expect(s.projects.some((p) => p.id === "p2")).toBe(false);
    // p2 のタスクは受信トレイへ（未完了は inbox=true、完了済みは inbox 据え置き=false）。
    const n1 = s.tasks.find((t) => t.id === "n1")!;
    const n2 = s.tasks.find((t) => t.id === "n2")!;
    expect(n1.project).toBeNull();
    expect(n1.inbox).toBe(true);
    expect(n2.project).toBeNull();
    expect(n2.inbox).toBe(false);
    // 無関係な p1 のタスクは不変。
    expect(s.tasks.find((t) => t.id === "n3")?.project).toBe("p1");
    // 表示中ビューが消えたので today へ退避。
    expect(s.view).toBe("today");
  });

  it("delProject: defaultProject が消えたら残るプロジェクトへフォールバック", () => {
    useStore.setState((s) => ({ settings: { ...s.settings, defaultProject: "p2" }, paletteProjectId: "p2" }));
    useStore.getState().delProject("p2");
    expect(useStore.getState().settings.defaultProject).toBe("p1");
    expect(useStore.getState().paletteProjectId).toBe("p1");
  });

  it("delProject: 最後の1件を消したら defaultProject は空文字（受信トレイ既定）", () => {
    useStore.setState({ projects: [{ id: "p1", name: "個人", color: "#1a73e8" }], view: "p1" });
    useStore.setState((s) => ({ settings: { ...s.settings, defaultProject: "p1" }, paletteProjectId: "p1" }));
    useStore.getState().delProject("p1");
    expect(useStore.getState().projects).toHaveLength(0);
    expect(useStore.getState().settings.defaultProject).toBe("");
    expect(useStore.getState().paletteProjectId).toBe("");
  });
});

describe("setPriority（#D）", () => {
  beforeEach(() => resetStore());

  it("該当タスクの優先度を変える（他は不変）", () => {
    useStore.setState({
      tasks: [
        { id: "n1", title: "A", project: null, pri: "med", due: null, time: null, done: false, inbox: true, notes: "" },
        { id: "n2", title: "B", project: null, pri: "low", due: null, time: null, done: false, inbox: true, notes: "" },
      ],
    });
    useStore.getState().setPriority("n1", "high");
    expect(useStore.getState().tasks.find((t) => t.id === "n1")?.pri).toBe("high");
    expect(useStore.getState().tasks.find((t) => t.id === "n2")?.pri).toBe("low");
  });
});

describe("autostart（#8）", () => {
  beforeEach(() => resetStore());

  it("setAutostart は settings.autostart を反映する（他設定は不変）", () => {
    const before = useStore.getState().settings;
    useStore.getState().setAutostart(true);
    expect(useStore.getState().settings.autostart).toBe(true);
    // 他キーは保持。
    expect(useStore.getState().settings.open).toBe(before.open);
    useStore.getState().setAutostart(false);
    expect(useStore.getState().settings.autostart).toBe(false);
  });

  it("toggleAutostart はブラウザ（Tauri 非環境）では即座に反転する（no-op invoke）", () => {
    // node 環境では window が無く isTauriRuntime()=false → 見た目だけ反転。
    expect(useStore.getState().settings.autostart).toBe(false);
    useStore.getState().toggleAutostart();
    expect(useStore.getState().settings.autostart).toBe(true);
    useStore.getState().toggleAutostart();
    expect(useStore.getState().settings.autostart).toBe(false);
  });
});
