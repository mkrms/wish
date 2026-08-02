// タスク入力の解析（明示プレフィックス方式 / D-031・spec/feature/task-input-syntax.md）。
// 例: 「設計レビュー @明日 @15:00 #ECサイト !高」→ 日付 / 時刻 / プロジェクト / 優先度
//
// 裸のテキストからの推測は行わない。以前は「金曜」等を推測していたため
// 「入出金」→ 金曜日、「3時間」→ 3:00 のような誤爆が起きていた（D-031）。
// 解釈できなかったトークン（@xyz / 未登録の #名前）は、黙って消さずタイトルに残す。

import type { ParseResult, Project } from "../types";
import { WD, addDays, nextWeekday, today } from "./date";

/** 記法のプレフィックス（半角・全角）。トークンは空白か次のプレフィックスまで。 */
const TOKEN = /[@＠#＃!！][^\s@＠#＃!！]*/g;

/** 全角プレフィックスを半角へ正規化。 */
function kindOf(ch: string): "@" | "#" | "!" {
  if (ch === "＠") return "@";
  if (ch === "＃") return "#";
  if (ch === "！") return "!";
  return ch as "@" | "#" | "!";
}

export function parse(str: string, projects: Project[], base: Date = today()): ParseResult {
  const r: ParseResult = { title: "", due: null, time: null, project: null, pri: null };

  // 各トークンを走査し、解釈できたものだけ取り除く（解釈できなければ元のまま残す）。
  const rest = str.replace(TOKEN, (tok) => {
    const kind = kindOf(tok[0]);
    const body = tok.slice(1);
    if (!body) return tok; // プレフィックスのみ（入力途中）はそのまま

    if (kind === "@") {
      const d = parseDate(body, base);
      if (d) {
        // 同種が複数あるときは最初の 1 つを採用し、以降は捨てる。
        if (!r.due) r.due = iso(d);
        return " ";
      }
      const t = parseTime(body);
      if (t) {
        if (!r.time) r.time = t;
        return " ";
      }
      return tok;
    }

    if (kind === "#") {
      const p = findProject(body, projects);
      if (!p) return tok; // 未登録のプロジェクト名は本文として残す
      if (!r.project) r.project = p.id;
      return " ";
    }

    // "!" 優先度
    const pri = body === "高" ? "high" : body === "中" ? "med" : body === "低" ? "low" : null;
    if (!pri) return tok;
    if (!r.pri) r.pri = pri;
    return " ";
  });

  r.title = rest.replace(/\s+/g, " ").trim();
  return r;
}

/** `@` の本体を日付として解釈する。解釈できなければ null。 */
export function parseDate(body: string, base: Date = today()): Date | null {
  if (body === "今日") return base;
  if (body === "明日") return addDays(1, base);
  if (body === "明後日") return addDays(2, base);
  if (body === "今週末") return nextWeekday(6, base);
  if (body === "来週") return addDays(7, base);

  // 曜日: @金 / @金曜 / @金曜日 → 次に来るその曜日
  let m = body.match(/^([月火水木金土日])(曜日?)?$/);
  if (m) return nextWeekday(WD.indexOf(m[1] as (typeof WD)[number]), base);

  // N 日後: @+3d / @+3
  if ((m = body.match(/^\+(\d{1,3})d?$/))) return addDays(parseInt(m[1], 10), base);

  // 月/日: @8/10（年は今年）
  if ((m = body.match(/^(\d{1,2})\/(\d{1,2})$/))) {
    const mo = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
    const dt = new Date(base.getFullYear(), mo - 1, day);
    dt.setHours(0, 0, 0, 0);
    // 2/30 のような不正日は Date が繰り上げるので弾く。
    if (dt.getMonth() !== mo - 1 || dt.getDate() !== day) return null;
    return dt;
  }

  return null;
}

/** `@` の本体を時刻（"HH:MM"）として解釈する。解釈できなければ null。 */
export function parseTime(body: string): string | null {
  // @15:00 / @9:30
  let m = body.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (m) return m[1].padStart(2, "0") + ":" + m[2];
  // @15時 / @15時30分 / @15時30
  if ((m = body.match(/^([01]?\d|2[0-3])時(?:([0-5]?\d)分?)?$/))) {
    return m[1].padStart(2, "0") + ":" + (m[2] ? m[2].padStart(2, "0") : "00");
  }
  return null;
}

/**
 * `#` の本体からプロジェクトを引く。空白を除いて比較し、前方一致 → 部分一致の順。
 * 以前の逆方向あいまい一致（入力がプロジェクト名の先頭 2 文字を含めば一致）は
 * 誤爆源のため廃止した（候補サジェストがあるので緩いマッチは不要・D-031）。
 */
export function findProject(query: string, projects: Project[]): Project | null {
  const norm = (x: string) => x.replace(/\s/g, "");
  const q = norm(query);
  if (!q) return null;
  return (
    projects.find((p) => norm(p.name).startsWith(q)) ??
    projects.find((p) => norm(p.name).includes(q)) ??
    null
  );
}

function iso(d: Date): string {
  return d.toISOString();
}
