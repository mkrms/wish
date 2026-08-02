// store.ts の persist migrate（旧データ移行）のユニットテスト。
// 一次ソースは .claude/spec/feature/dashboard.md の AC-32 と「移行」記述、
// および中-1/中-2 のレビュー指摘を反映した最終形（version 非依存・冪等・純粋関数化）。
//
// migrate ロジックは store.ts で純粋関数 `migrateState` として named export されている
// （テスト可能化のための最小変更。ロジックは元の inline migrate と同一）。これを直接検証する。
//
// migrateState は副作用のない純粋関数。store.ts の import 時に zustand persist が
// 初期化されるが、storage アクセスは遅延され node 環境でも import は成立する
// （localStorage 無しでも persist は警告に留まり throw しない）。追加依存（jsdom）不要。

import { describe, it, expect } from "vitest";
import { migrateState } from "./store";
import type { Memo, Settings, Task } from "./types";

/** 旧フィールド入りの project（保存データに残っている想定）。 */
function legacyProject(id: string, name: string, color: string) {
  return {
    id,
    name,
    color,
    recent: 7,
    stale: true,
    staleDays: 21,
    bars: [1, 2, 3, 4, 5, 6, 7, 8],
  };
}

/** 旧フィールド（type / sub）入りの task（v1 以前の保存データに残っている想定）。 */
function legacyTask(id: string) {
  return {
    id,
    title: "サンプル",
    project: "p1",
    type: "開発",
    pri: "med",
    due: null,
    time: null,
    done: true,
    doneAt: "2026-06-20T00:00:00.000Z",
    inbox: false,
    sub: [{ title: "s", done: false }],
    notes: "memo",
  };
}

/** 現行（v2）形式の task。 */
const sampleTask: Task = {
  id: "t1",
  title: "サンプル",
  project: "p1",
  pri: "med",
  due: null,
  time: null,
  done: true,
  doneAt: "2026-06-20T00:00:00.000Z",
  inbox: false,
  notes: "memo",
};

const sampleMemo: Memo = { id: "me1", text: "memo", createdAt: "2026-06-01T00:00:00.000Z" };

const sampleSettings: Settings = {
  open: "Ctrl+Space",
  add: "Ctrl+N",
  weekStart: "月",
  defaultProject: "p1",
  notifyDue: true,
  notifyDaily: false,
  autostart: false,
  sortKey: "added",
  sortDir: "desc",
  autoUpdateCheck: true,
};

describe("migrateState（v2 旧データ移行）", () => {
  it("旧フィールド入り projects → 各 project が {id,name,color} のみになる", () => {
    const persisted = {
      tasks: [sampleTask],
      projects: [legacyProject("p1", "案件A", "#1a73e8"), legacyProject("p2", "案件B", "#34a853")],
      memos: [sampleMemo],
      settings: sampleSettings,
      seq: 100,
    };
    const out = migrateState(persisted) as typeof persisted;
    for (const p of out.projects) {
      expect(Object.keys(p).sort()).toEqual(["color", "id", "name"]);
      expect("recent" in p).toBe(false);
      expect("stale" in p).toBe(false);
      expect("staleDays" in p).toBe(false);
      expect("bars" in p).toBe(false);
    }
    // 値そのものは保持される。
    expect(out.projects[0]).toEqual({ id: "p1", name: "案件A", color: "#1a73e8" });
    expect(out.projects[1]).toEqual({ id: "p2", name: "案件B", color: "#34a853" });
  });

  it("v2: 旧フィールド入り tasks（type/sub）→ 各 task から type/sub が剥がれる", () => {
    const persisted = {
      tasks: [legacyTask("t1"), legacyTask("t2")],
      projects: [legacyProject("p1", "案件A", "#1a73e8")],
      memos: [sampleMemo],
      settings: sampleSettings,
      seq: 100,
    };
    const out = migrateState(persisted) as { tasks: Task[] };
    for (const t of out.tasks) {
      expect("type" in t).toBe(false);
      expect("sub" in t).toBe(false);
      // 現行 Task の許容フィールドのみが残る。
      expect(Object.keys(t).sort()).toEqual(
        ["done", "doneAt", "due", "id", "inbox", "notes", "pri", "project", "time", "title"].sort()
      );
    }
    // 他フィールドの値は保持される。
    expect(out.tasks[0]).toEqual({
      id: "t1",
      title: "サンプル",
      project: "p1",
      pri: "med",
      due: null,
      time: null,
      done: true,
      doneAt: "2026-06-20T00:00:00.000Z",
      inbox: false,
      notes: "memo",
    });
  });

  it("v2: doneAt が無い task でも落ちず doneAt キーを付けない", () => {
    const noDoneAt = {
      id: "t9",
      title: "未完了",
      project: null,
      type: "開発",
      pri: "low",
      due: null,
      time: null,
      done: false,
      inbox: true,
      sub: [],
      notes: "",
    };
    const persisted = {
      tasks: [noDoneAt],
      projects: [{ id: "p1", name: "個人", color: "#1a73e8" }],
      memos: [],
      settings: sampleSettings,
      seq: 1,
    };
    const out = migrateState(persisted) as { tasks: Task[] };
    expect("type" in out.tasks[0]).toBe(false);
    expect("sub" in out.tasks[0]).toBe(false);
    expect("doneAt" in out.tasks[0]).toBe(false);
  });

  it("memos / settings / seq は改変されない（同値・同参照で引き継がれる）", () => {
    const persisted = {
      tasks: [legacyTask("t1")],
      projects: [legacyProject("p1", "案件A", "#1a73e8")],
      memos: [sampleMemo],
      settings: sampleSettings,
      seq: 100,
    };
    const out = migrateState(persisted) as typeof persisted;
    // migrate はこれらに触れない（参照ごと引き継がれる）。
    expect(out.memos).toBe(persisted.memos);
    expect(out.settings).toBe(persisted.settings);
    expect(out.seq).toBe(100);
    expect(out.memos).toEqual(persisted.memos);
    expect(out.settings).toEqual(persisted.settings);
  });

  it("冪等性: 既に新形式の projects/tasks を渡しても壊れず同形を返す", () => {
    const persisted = {
      tasks: [sampleTask],
      projects: [{ id: "p1", name: "案件A", color: "#1a73e8" }],
      memos: [],
      settings: sampleSettings,
      seq: 1,
    };
    const once = migrateState(persisted) as typeof persisted;
    const twice = migrateState(once) as typeof persisted;
    expect(twice.projects).toEqual([{ id: "p1", name: "案件A", color: "#1a73e8" }]);
    expect(twice.projects).toEqual(once.projects);
    expect(twice.tasks).toEqual([sampleTask]);
    expect(twice.tasks).toEqual(once.tasks);
  });

  it("純粋性: 入力オブジェクトを変異させない（呼び出し後も入力に旧フィールドが残る）", () => {
    const legacyP = legacyProject("p1", "案件A", "#1a73e8");
    const legacyT = legacyTask("t1");
    const persisted = {
      tasks: [legacyT],
      projects: [legacyP],
      memos: [],
      settings: sampleSettings,
      seq: 1,
    };
    const out = migrateState(persisted) as typeof persisted;
    // 入力側は無傷（旧フィールドが残っている）= 新オブジェクトが返っている。
    expect(legacyP.recent).toBe(7);
    expect(legacyP.bars).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect((legacyT as { type?: string }).type).toBe("開発");
    expect((legacyT as { sub?: unknown[] }).sub).toEqual([{ title: "s", done: false }]);
    // 返り値は別オブジェクト。
    expect(out).not.toBe(persisted);
    expect(out.projects).not.toBe(persisted.projects);
    expect(out.projects[0]).not.toBe(legacyP);
    expect(out.tasks).not.toBe(persisted.tasks);
    expect(out.tasks[0]).not.toBe(legacyT);
  });

  it("projects が配列でない（tasks も無い）とき落ちず、そのまま返す", () => {
    const noArrays = { memos: [], settings: sampleSettings, seq: 1 };
    expect(() => migrateState(noArrays)).not.toThrow();
    // projects / tasks いずれも配列でないので整形対象がなく、同参照で返る。
    expect(migrateState(noArrays)).toBe(noArrays);
  });

  it("projects=null でも落ちず、tasks のみ整形する", () => {
    const nullProjects = {
      tasks: [legacyTask("t1")],
      projects: null,
      memos: [],
      settings: sampleSettings,
      seq: 1,
    };
    expect(() => migrateState(nullProjects)).not.toThrow();
    const out = migrateState(nullProjects) as { projects: unknown; tasks: Task[] };
    // projects は配列でないので触らない。
    expect(out.projects).toBeNull();
    // tasks は整形される。
    expect("type" in out.tasks[0]).toBe(false);
  });

  it("空配列・undefined・null でも落ちない", () => {
    const empty = { tasks: [], projects: [], memos: [], settings: sampleSettings, seq: 0 };
    const out = migrateState(empty) as typeof empty;
    expect(out.projects).toEqual([]);
    expect(out.tasks).toEqual([]);

    expect(() => migrateState(undefined)).not.toThrow();
    expect(migrateState(undefined)).toBeUndefined();
    expect(() => migrateState(null)).not.toThrow();
    expect(migrateState(null)).toBeNull();
  });

  it("#8: settings.autostart が無い旧データには既定 false を補完する（他キーは保持）", () => {
    const legacySettings = {
      open: "Alt + Space",
      add: "Ctrl + K",
      weekStart: "月",
      defaultProject: "p1",
      notifyDue: true,
      notifyDaily: true,
    };
    const persisted = { tasks: [], projects: [], memos: [], settings: legacySettings, seq: 0 };
    const out = migrateState(persisted) as { settings: Settings };
    expect(out.settings.autostart).toBe(false);
    // 他の設定値は保持される。
    expect(out.settings.open).toBe("Alt + Space");
    expect(out.settings.notifyDue).toBe(true);
    // 入力は変異しない（新オブジェクトを返す）。
    expect("autostart" in legacySettings).toBe(false);
  });

  it("#8: settings.autostart が既にあれば settings 参照は保持される（同参照・冪等）", () => {
    const settings: Settings = { ...sampleSettings, autostart: true };
    const persisted = { tasks: [], projects: [], memos: [], settings, seq: 0 };
    const out = migrateState(persisted) as { settings: Settings };
    // 既に boolean が入っているので補完不要 → 参照そのまま。
    expect(out.settings).toBe(settings);
    expect(out.settings.autostart).toBe(true);
  });

  it("D-030: settings.autoUpdateCheck が無い旧データには既定 true を補完する（他キーは保持）", () => {
    const { autoUpdateCheck: _omit, ...legacySettings } = sampleSettings;
    const persisted = { tasks: [], projects: [], memos: [], settings: legacySettings, seq: 0 };
    const out = migrateState(persisted) as { settings: Settings };
    expect(out.settings.autoUpdateCheck).toBe(true);
    // 他の設定値は保持される。
    expect(out.settings.sortKey).toBe("added");
    expect(out.settings.autostart).toBe(false);
    // 入力は変異しない（新オブジェクトを返す）。
    expect("autoUpdateCheck" in legacySettings).toBe(false);
  });

  it("D-030: autoUpdateCheck=false を明示済みなら false のまま（既定で上書きしない）", () => {
    const settings: Settings = { ...sampleSettings, autoUpdateCheck: false };
    const persisted = { tasks: [], projects: [], memos: [], settings, seq: 0 };
    const out = migrateState(persisted) as { settings: Settings };
    // 補完不要 → 参照そのまま。
    expect(out.settings).toBe(settings);
    expect(out.settings.autoUpdateCheck).toBe(false);
  });
});
