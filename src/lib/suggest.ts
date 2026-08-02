// 入力候補サジェスト（D-031 / spec/feature/task-input-syntax.md）。
// 「@ / # / ! を打ったら候補が出る」ための純粋ロジック。描画は components/TaskInput.tsx。
//
// 記法を覚えなくても入力できるようにするのが目的。明示プレフィックス方式で増えた
// タイプ量を、候補選択で相殺する。

import type { Project } from "../types";
import { WD, addDays, nextWeekday, today } from "./date";
import { parseDate, parseTime } from "./parse";

export type TokenKind = "@" | "#" | "!";

/** カーソル位置にある記法トークン（置換範囲つき）。 */
export interface ActiveToken {
  kind: TokenKind;
  /** プレフィックス直後からカーソルまでの入力（絞り込みに使う）。 */
  query: string;
  /** テキスト内のトークン開始位置（プレフィックス自身）。 */
  start: number;
  /** テキスト内のトークン終了位置（この手前まで置換する）。 */
  end: number;
}

/** ドロップダウンに出す 1 件。 */
export interface Suggestion {
  label: string;
  /** 右側の補足（日付など）。 */
  hint?: string;
  /** 確定時にトークンを置き換える文字列（プレフィックス込み）。 */
  insert: string;
  /** プロジェクト候補の色ドット。 */
  color?: string;
}

const PREFIX = /[@＠#＃!！]/;

function kindOf(ch: string): TokenKind {
  if (ch === "＠") return "@";
  if (ch === "＃") return "#";
  if (ch === "！") return "!";
  return ch as TokenKind;
}

/**
 * カーソル直前を左へ辿り、記法トークンの中にいれば返す。
 * 空白に当たったら（＝トークン外なので）null。
 */
export function activeToken(text: string, caret: number): ActiveToken | null {
  const pos = Math.max(0, Math.min(caret, text.length));
  for (let i = pos - 1; i >= 0; i--) {
    const ch = text[i];
    if (/\s/.test(ch)) return null;
    if (!PREFIX.test(ch)) continue;
    // トークンの終端はカーソル以降で最初の空白 or 次のプレフィックスまで。
    let end = pos;
    while (end < text.length && !/\s/.test(text[end]) && !PREFIX.test(text[end])) end++;
    return { kind: kindOf(ch), query: text.slice(i + 1, pos), start: i, end };
  }
  return null;
}

/** M/D 表記（ヒント用）。 */
function md(d: Date): string {
  return d.getMonth() + 1 + "/" + d.getDate();
}

/** 前方一致（空白無視）。query が空なら常に true。 */
function matches(label: string, query: string): boolean {
  const q = query.replace(/\s/g, "");
  if (!q) return true;
  return label.replace(/\s/g, "").startsWith(q);
}

/**
 * トークンに対する候補一覧。表示件数の上限は呼び出し側（UI）で扱う。
 * base は「今日」。テスト可能にするため引数で受ける。
 */
export function suggestFor(token: ActiveToken, projects: Project[], base: Date = today()): Suggestion[] {
  if (token.kind === "!") {
    return [
      { label: "高", insert: "!高", color: "#d93025" },
      { label: "中", insert: "!中", color: "#f9ab00" },
      { label: "低", insert: "!低", color: "#9aa0a6" },
    ].filter((s) => matches(s.label, token.query));
  }

  if (token.kind === "#") {
    const q = token.query.replace(/\s/g, "");
    const norm = (x: string) => x.replace(/\s/g, "");
    const hit = (p: Project) => !q || norm(p.name).includes(q);
    // 前方一致を先に、続いて部分一致（parse.findProject と同じ優先順）。
    const head = projects.filter((p) => norm(p.name).startsWith(q));
    const tail = projects.filter((p) => hit(p) && !norm(p.name).startsWith(q));
    return [...head, ...tail].map((p) => ({
      label: p.name,
      insert: "#" + norm(p.name),
      color: p.color,
    }));
  }

  // "@" 日付・時刻
  const q = token.query;

  // 数字・+ で始まるときは、入力そのものの解釈を動的候補として出す。
  if (/^[+\d]/.test(q)) {
    const out: Suggestion[] = [];
    const t = parseTime(q);
    if (t) out.push({ label: t, hint: "時刻", insert: "@" + t });
    const d = parseDate(q, base);
    if (d) out.push({ label: md(d), hint: dayLabel(d, base), insert: "@" + q });
    // 「@15」のように時刻とも日数ともとれる入力には、両方の候補を出す。
    if (!t && /^([01]?\d|2[0-3])$/.test(q)) {
      const hh = q.padStart(2, "0") + ":00";
      out.push({ label: hh, hint: "時刻", insert: "@" + hh });
    }
    if (!d && /^\+?(\d{1,3})$/.test(q)) {
      const n = parseInt(q.replace("+", ""), 10);
      const dd = addDays(n, base);
      out.push({ label: md(dd), hint: n + "日後", insert: "@+" + n + "d" });
    }
    return out;
  }

  const rel: Suggestion[] = [
    { label: "今日", date: base },
    { label: "明日", date: addDays(1, base) },
    { label: "明後日", date: addDays(2, base) },
    { label: "今週末", date: nextWeekday(6, base) },
    { label: "来週", date: addDays(7, base) },
  ].map((x) => ({ label: x.label, hint: md(x.date), insert: "@" + x.label }));

  // 曜日は月曜始まりで並べる（WD は日曜始まりなので回す）。
  const wd: Suggestion[] = [1, 2, 3, 4, 5, 6, 0].map((dow) => {
    const d = nextWeekday(dow, base);
    return { label: WD[dow] + "曜", hint: md(d), insert: "@" + WD[dow] + "曜" };
  });

  return [...rel, ...wd].filter((s) => matches(s.label, q));
}

/** 日付候補のヒント（今日/明日/N日後）。 */
function dayLabel(d: Date, base: Date): string {
  const n = Math.round((d.getTime() - base.getTime()) / 86400000);
  if (n === 0) return "今日";
  if (n === 1) return "明日";
  if (n > 0) return n + "日後";
  return Math.abs(n) + "日前";
}

/**
 * 候補を確定してテキストを書き換える。トークンを insert で置換し、
 * 続けて入力できるよう後ろに空白を 1 つ確保してカーソルをその後ろへ置く。
 */
export function applySuggestion(text: string, token: ActiveToken, insert: string): { text: string; caret: number } {
  const before = text.slice(0, token.start);
  const after = text.slice(token.end);
  const mid = insert + (after.startsWith(" ") ? "" : " ");
  return { text: before + mid + after, caret: (before + mid).length };
}
