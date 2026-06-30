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

const sampleTask: Task = {
  id: "t1",
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

const sampleMemo: Memo = { id: "me1", text: "memo", createdAt: "2026-06-01T00:00:00.000Z" };

const sampleSettings: Settings = {
  open: "Ctrl+Space",
  add: "Ctrl+N",
  weekStart: "月",
  defaultProject: "p1",
  notifyDue: true,
  notifyDaily: false,
};

describe("migrateState（AC-32 旧データ移行）", () => {
  it("AC-32: 旧フィールド入り projects → 各 project が {id,name,color} のみになる", () => {
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

  it("AC-32: tasks / memos / settings / seq は改変されない（同値で引き継がれる）", () => {
    const persisted = {
      tasks: [sampleTask],
      projects: [legacyProject("p1", "案件A", "#1a73e8")],
      memos: [sampleMemo],
      settings: sampleSettings,
      seq: 100,
    };
    const out = migrateState(persisted) as typeof persisted;
    // 参照ごと引き継がれること（migrate はこれらに触れない）。
    expect(out.tasks).toBe(persisted.tasks);
    expect(out.memos).toBe(persisted.memos);
    expect(out.settings).toBe(persisted.settings);
    expect(out.seq).toBe(100);
    // 値も同一。
    expect(out.tasks).toEqual(persisted.tasks);
    expect(out.memos).toEqual(persisted.memos);
    expect(out.settings).toEqual(persisted.settings);
  });

  it("冪等性: 既に新形式の projects を渡しても壊れず同形を返す", () => {
    const persisted = {
      tasks: [],
      projects: [{ id: "p1", name: "案件A", color: "#1a73e8" }],
      memos: [],
      settings: sampleSettings,
      seq: 1,
    };
    const once = migrateState(persisted) as typeof persisted;
    const twice = migrateState(once) as typeof persisted;
    expect(twice.projects).toEqual([{ id: "p1", name: "案件A", color: "#1a73e8" }]);
    // 2回適用しても形は変わらない。
    expect(twice.projects).toEqual(once.projects);
  });

  it("純粋性: 入力オブジェクトを変異させない（呼び出し後も入力に旧フィールドが残る）", () => {
    const legacy = legacyProject("p1", "案件A", "#1a73e8");
    const persisted = {
      tasks: [],
      projects: [legacy],
      memos: [],
      settings: sampleSettings,
      seq: 1,
    };
    const out = migrateState(persisted) as typeof persisted;
    // 入力側は無傷（旧フィールドが残っている）= 新オブジェクトが返っている。
    expect(legacy.recent).toBe(7);
    expect(legacy.bars).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect((persisted.projects[0] as { stale?: boolean }).stale).toBe(true);
    // 返り値は別オブジェクト。
    expect(out).not.toBe(persisted);
    expect(out.projects).not.toBe(persisted.projects);
    expect(out.projects[0]).not.toBe(legacy);
  });

  it("projects が配列でないとき落ちず、そのまま返す", () => {
    const noProjects = { tasks: [], memos: [], settings: sampleSettings, seq: 1 };
    expect(() => migrateState(noProjects)).not.toThrow();
    expect(migrateState(noProjects)).toBe(noProjects);

    const nullProjects = { tasks: [], projects: null, memos: [], settings: sampleSettings, seq: 1 };
    expect(() => migrateState(nullProjects)).not.toThrow();
    expect(migrateState(nullProjects)).toBe(nullProjects);
  });

  it("空配列・undefined・非オブジェクトでも落ちない", () => {
    // projects 空配列。
    const empty = { tasks: [], projects: [], memos: [], settings: sampleSettings, seq: 0 };
    const out = migrateState(empty) as typeof empty;
    expect(out.projects).toEqual([]);

    // undefined / null。
    expect(() => migrateState(undefined)).not.toThrow();
    expect(migrateState(undefined)).toBeUndefined();
    expect(() => migrateState(null)).not.toThrow();
  });
});
