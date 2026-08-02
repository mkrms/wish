// メモ → タスク化の純粋ロジック（src/lib/memo.ts）のユニットテスト。
// C メモ構造化一括登録: フォーム入力 → 保留タスク構築 → 実タスク化。
// 自動抽出はしない（#5 撤去）。フォームの値を優先し、タスク名にだけ軽く parse をかける。

import { describe, it, expect } from "vitest";
import { buildPendingTask, pendingToTask } from "./memo";
import type { MemoTaskForm } from "./memo";
import { parse } from "./parse";
import type { Project } from "../types";

const projects: Project[] = [{ id: "p1", name: "ECサイト", color: "#1a73e8" }];

function form(over: Partial<MemoTaskForm> = {}): MemoTaskForm {
  return { title: "", project: null, pri: "med", due: null, ...over };
}

describe("buildPendingTask（フォーム + 軽い parse → 保留タスク）", () => {
  it("タイトル空なら null（保留に積めない）", () => {
    expect(buildPendingTask("k1", form({ title: "   " }), parse("", projects))).toBeNull();
  });

  it("フォームの値を優先する（project/pri/due を明示していれば parse より優先）", () => {
    const f = form({ title: "見積もり修正 #ECサイト !低 @明日", project: "p1", pri: "high", due: "2026-07-01T00:00:00.000Z" });
    const p = buildPendingTask("k2", f, parse(f.title, projects));
    expect(p).not.toBeNull();
    expect(p!.project).toBe("p1"); // フォーム優先（parse の #ECサイト と一致だが、フォームを採用）
    expect(p!.pri).toBe("high"); // フォーム優先（parse の !低 を上書き）
    expect(p!.due).toBe("2026-07-01T00:00:00.000Z"); // フォーム優先
  });

  it("フォーム未指定（project=null / pri=med / due=null）のときだけ parse を採用する", () => {
    const f = form({ title: "設計レビュー @明日 @15:00 #ECサイト !高" });
    const p = buildPendingTask("k3", f, parse(f.title, projects));
    expect(p!.title).toBe("設計レビュー"); // parse 後の本文（記号を剥がす）
    expect(p!.project).toBe("p1"); // フォーム未指定 → parse の #ECサイト
    expect(p!.pri).toBe("high"); // フォーム既定 med → parse の !高
    expect(p!.due).not.toBeNull(); // フォーム未指定 → parse の明日
    expect(p!.time).toBe("15:00"); // 時刻は parse のみ
  });

  it("parse 後 title が空でも、生のフォーム title にフォールバックする", () => {
    // "@明日" だけだと parse 後 title が空になる → フォーム title を使う。
    const f = form({ title: "@明日" });
    const p = buildPendingTask("k4", f, parse(f.title, projects));
    expect(p).not.toBeNull();
    expect(p!.title).toBe("@明日");
  });

  it("入力（form / parsed）を変異させない（純粋）", () => {
    const f = form({ title: "a" });
    const snapshot = JSON.stringify(f);
    buildPendingTask("k5", f, parse("a", projects));
    expect(JSON.stringify(f)).toBe(snapshot);
  });
});

describe("pendingToTask（保留タスク → 実 Task）", () => {
  it("プロジェクト未指定（null）は受信トレイ（inbox=true）、notes は空（メモ本文を引き継がない）", () => {
    const p = buildPendingTask("k6", form({ title: "買い物" }), parse("買い物", projects))!;
    const t = pendingToTask("n5", p);
    expect(t.id).toBe("n5");
    expect(t.title).toBe("買い物");
    expect(t.project).toBeNull();
    expect(t.inbox).toBe(true);
    expect(t.done).toBe(false);
    expect(t.notes).toBe("");
  });

  it("プロジェクト指定があれば inbox=false（受信トレイに入れない）", () => {
    const p = buildPendingTask("k7", form({ title: "実装", project: "p1" }), parse("実装", projects))!;
    const t = pendingToTask("n6", p);
    expect(t.project).toBe("p1");
    expect(t.inbox).toBe(false);
  });

  it("ParseResult に type キーが無い（#6 種別廃止の回帰）", () => {
    const r = parse("設計レビュー @明日 @15:00 #ECサイト !高", projects);
    expect("type" in r).toBe(false);
  });
});
