// メモ → タスク化の純粋ロジック（描画・store から分離）。
// #2 メモ2ペイン（手動一括追加）と #5 候補自動抽出撤去の方針に基づく。
// 自動抽出はしない。ユーザーが手で入力した行を、既存 parse() を通して受信トレイ用タスクへ写像する。

import type { ParseResult, Priority, Task } from "../types";

/**
 * 複数行のテキスト（右ペインの入力）から、タスク化対象の行だけを抽出する。
 * - 改行で分割し、前後空白をトリム。
 * - 空行は除外する。
 * 純粋・入力非変異。
 */
export function memoTaskLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** メモ1行 + parse 結果から、受信トレイ用タスクを 1 件構築する。 */
export function buildMemoTask(
  id: string,
  parsed: ParseResult,
  notes: string
): Task {
  return {
    id,
    title: parsed.title,
    // 右ペインからは受信トレイ（未仕分け）へ入れる（後で仕分け）。
    project: null,
    pri: (parsed.pri || "med") as Priority,
    due: parsed.due,
    time: parsed.time,
    done: false,
    inbox: true,
    // 元メモ本文をタスクの notes に保持（memoToTask の挙動を踏襲・拡張）。
    notes,
  };
}
