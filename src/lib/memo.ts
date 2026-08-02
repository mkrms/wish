// メモ → タスク化の純粋ロジック（描画・store から分離）。
// #2 / C メモ構造化一括登録: フォームで 1 件ずつ入力 → 保留リストに積む → 一括登録。
// 自動抽出はしない（#5 撤去）。ユーザーがフォームで入力した値を優先し、タスク名にだけ
// 軽く parse をかけて明示記法（@日付 / #案件 / !優先度。D-031）を拾う。

import type { ParseResult, Priority, Task } from "../types";

/** 保留リストの 1 件（まだ tasks には積まれていない、フォーム入力済みの下書き）。 */
export interface PendingTask {
  /** 保留リスト内の一意キー（登録前の UI 用。tasks の id とは別物）。 */
  key: string;
  title: string;
  /** プロジェクト ID。受信トレイ（未仕分け）は null。 */
  project: string | null;
  pri: Priority;
  /** 締切日（ISO 文字列）。未指定は null。 */
  due: string | null;
  /** 時間指定 "HH:MM"。未指定は null。 */
  time: string | null;
}

/** フォーム入力（生の値）。プロジェクト・優先度・日付はフォームの値を優先する。 */
export interface MemoTaskForm {
  title: string;
  project: string | null;
  pri: Priority;
  due: string | null;
}

/**
 * フォーム入力 + タスク名の軽い parse から保留タスクを 1 件構築する。純粋・入力非変異。
 * - タスク名は parse に通し、記法（@明日 / @15:00 / #案件 / !高。D-031）を拾う。
 * - ただし**フォームの値を優先**する: フォームで project/pri/due を明示していればそれを使い、
 *   未指定（project=null は「受信トレイ」を明示とみなさず parse 結果で補完）/ pri は parse があれば
 *   採用、due はフォーム優先で parse は補完。
 * - parse 後の title（記号を剥がした本文）を採用する。空なら元の生 title にフォールバック。
 * 戻り値が null のときは「タイトルが空」で保留に積めない。
 */
export function buildPendingTask(key: string, form: MemoTaskForm, parsed: ParseResult): PendingTask | null {
  const title = (parsed.title || form.title).trim();
  if (!title) return null;
  return {
    key,
    title,
    // プロジェクトはフォーム優先。未選択（null）のときだけ parse の #プロジェクトを採用。
    project: form.project !== null ? form.project : parsed.project,
    // 優先度はフォーム値を基本に、フォームが既定（med）で parse が明示していれば parse を採用。
    pri: form.pri !== "med" ? form.pri : (parsed.pri || "med"),
    // 日付はフォーム優先。未指定のときだけ parse の日付を採用。
    due: form.due !== null ? form.due : parsed.due,
    // 時刻はフォームに無いので parse のみ。
    time: parsed.time,
  };
}

/**
 * 保留タスク 1 件 → 実 Task へ写像する。純粋・入力非変異。
 * 一時メモはタスク棚卸用のメモであり、起こしたタスクへ本文は引き継がない（notes は空）。
 * メモ自体はメモとして残るため内容は失われない。
 */
export function pendingToTask(id: string, p: PendingTask): Task {
  return {
    id,
    title: p.title,
    project: p.project,
    // 受信トレイは「project=null かつ未仕分け」。プロジェクト指定があれば inbox=false。
    inbox: p.project === null,
    pri: p.pri,
    due: p.due,
    time: p.time,
    done: false,
    notes: "",
  };
}
