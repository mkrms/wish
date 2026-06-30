// メモ → タスク化の純粋ロジック（src/lib/memo.ts）のユニットテスト。
// #2 メモ2ペイン（手動一括追加）の中核ロジック。自動抽出はしない（#5 撤去）。

import { describe, it, expect } from "vitest";
import { memoTaskLines, buildMemoTask } from "./memo";
import { parse } from "./parse";
import type { Project } from "../types";

const projects: Project[] = [{ id: "p1", name: "ECサイト", color: "#1a73e8" }];

describe("memoTaskLines（一括入力 → 行抽出）", () => {
  it("改行で分割し、各行をトリムする", () => {
    expect(memoTaskLines("  a \n b  ")).toEqual(["a", "b"]);
  });

  it("空行・空白のみの行は除外する", () => {
    expect(memoTaskLines("a\n\n   \nb\n")).toEqual(["a", "b"]);
  });

  it("空文字・空白のみは空配列", () => {
    expect(memoTaskLines("")).toEqual([]);
    expect(memoTaskLines("   \n  \n")).toEqual([]);
  });

  it("入力を変異させない（純粋）", () => {
    const src = "a\nb";
    memoTaskLines(src);
    expect(src).toBe("a\nb");
  });
});

describe("buildMemoTask（1行 + parse → 受信トレイ用タスク）", () => {
  it("受信トレイ（project=null, inbox=true）になり、元メモ本文を notes に保持する", () => {
    const memoText = "元のメモ本文\n2行目";
    const t = buildMemoTask("n5", parse("買い物リスト作成", projects), memoText);
    expect(t.id).toBe("n5");
    expect(t.title).toBe("買い物リスト作成");
    expect(t.project).toBeNull();
    expect(t.inbox).toBe(true);
    expect(t.done).toBe(false);
    expect(t.notes).toBe(memoText);
    expect(t.pri).toBe("med"); // 優先度未指定は med
  });

  it("parse の日付/時刻/優先度を引き継ぐ（プロジェクト指定があっても受信トレイ固定）", () => {
    const t = buildMemoTask("n6", parse("設計レビュー 明日15時 #ECサイト !高", projects), "memo");
    expect(t.title).toBe("設計レビュー");
    expect(t.time).toBe("15:00");
    expect(t.due).not.toBeNull();
    expect(t.pri).toBe("high");
    // 右ペインからは受信トレイ固定（#プロジェクト指定でも null）。
    expect(t.project).toBeNull();
    expect(t.inbox).toBe(true);
  });

  it("ParseResult に type キーが無い（#6 種別廃止の回帰）", () => {
    const r = parse("明日15時 設計レビュー #ECサイト !高", projects);
    expect("type" in r).toBe(false);
  });
});
