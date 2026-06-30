// 自然言語タスク解析。プロトタイプの parse() / detectCandidates() を忠実に移植。
// 例: 「明日15時 設計レビュー #ECサイト !高」→ 日付 / 時刻 / 種別 / 優先度 / プロジェクト

import type { ParseResult, Project, TaskType } from "../types";
import { WD, addDays, nextWeekday, today } from "./date";

export function parse(str: string, projects: Project[], base: Date = today()): ParseResult {
  let s = " " + str + " ";
  const r: ParseResult = { title: "", due: null, time: null, project: null, type: null, pri: null };

  // 優先度
  if (/[!！]高|高優先/.test(s)) r.pri = "high";
  else if (/[!！]中/.test(s)) r.pri = "med";
  else if (/[!！]低/.test(s)) r.pri = "low";
  s = s.replace(/[!！](高|中|低)/g, " ").replace(/高優先/g, " ");

  // プロジェクト（#名前）
  const pm = s.match(/[#＃]([^\s#＃!！]+)/);
  if (pm) {
    const q = pm[1];
    const p = projects.find(
      (p) => p.name.replace(/\s/g, "").indexOf(q) >= 0 || q.indexOf(p.name.slice(0, 2)) >= 0
    );
    if (p) r.project = p.id;
    s = s.replace(pm[0], " ");
  }

  // 種別
  if (/設計/.test(s)) r.type = "設計";
  else if (/実装|開発|リファクタ|コーディング|バグ|修正|テスト/.test(s)) r.type = "開発";
  else if (/資料|報告書|ドキュメント|手順書|議事|メモ|doc/i.test(s)) r.type = "DOC";
  else if (/MTG|ミーティング|会議|定例|打ち合わせ|レビュー/.test(s)) r.type = "MTG";

  // 時刻
  let m: RegExpMatchArray | null;
  if ((m = s.match(/([01]?\d|2[0-3])\s*[:時]\s*([0-5]\d)?/))) {
    const hh = m[1].padStart(2, "0");
    const mm = m[2] || "00";
    r.time = hh + ":" + mm;
    s = s.replace(m[0], " ");
  }

  // 日付（自然言語）
  if (/今日/.test(s)) {
    r.due = iso(base);
    s = s.replace(/今日/g, " ");
  } else if (/明後日/.test(s)) {
    r.due = iso(addDays(2, base));
    s = s.replace(/明後日/g, " ");
  } else if (/明日/.test(s)) {
    r.due = iso(addDays(1, base));
    s = s.replace(/明日/g, " ");
  } else if (/今週末/.test(s)) {
    r.due = iso(nextWeekday(6, base));
    s = s.replace(/今週末/g, " ");
  } else if (/来週/.test(s)) {
    r.due = iso(addDays(7, base));
    s = s.replace(/来週/g, " ");
  } else if ((m = s.match(/\+(\d+)d/))) {
    r.due = iso(addDays(parseInt(m[1]), base));
    s = s.replace(m[0], " ");
  } else if ((m = s.match(/(月|火|水|木|金|土|日)曜?/))) {
    r.due = iso(nextWeekday(WD.indexOf(m[1] as (typeof WD)[number]), base));
    s = s.replace(m[0], " ");
  } else if ((m = s.match(/(\d{1,2})\/(\d{1,2})/))) {
    const dt = new Date(base.getFullYear(), parseInt(m[1]) - 1, parseInt(m[2]));
    dt.setHours(0, 0, 0, 0);
    r.due = iso(dt);
    s = s.replace(m[0], " ");
  }

  s = s.replace(/まで|までに/g, " ");
  r.title = s.replace(/\s+/g, " ").trim();
  return r;
}

function iso(d: Date): string {
  return d.toISOString();
}

export interface Candidate {
  key: string;
  text: string;
  typeText: TaskType;
}

/** メモ本文から「タスクにできそうな行」を抽出。 */
export function detectCandidates(text: string): Candidate[] {
  const lines = text.split(/\n/);
  const out: Candidate[] = [];
  lines.forEach((raw, idx) => {
    let l = raw
      .replace(/^[\s・\-*•]+/, "")
      .replace(/^\[?\s*要対応\s*\]?[:：]?/, "")
      .replace(/^\[\s*\]\s*/, "")
      .replace(/^todo[:：]?/i, "")
      .trim();
    if (!l) return;
    const isAction =
      /要対応|TODO|\[\s*\]/i.test(raw) ||
      /(する|します|作成|修正|共有|確認|対応|実装|設計|レビュー|提出|整理|調査|検討|更新|準備|定義|清書|探す|決定|追加|相談)$/.test(l) ||
      /(まで|金曜|来週|明日|今日)/.test(l);
    if (isAction) {
      let type: TaskType = "開発";
      if (/設計|方針|たたき台|定義/.test(l)) type = "設計";
      else if (/資料|報告書|議事|手順|メモ|清書|ドキュ/.test(l)) type = "DOC";
      else if (/MTG|会議|定例|レビュー|打ち合わせ|相談/.test(l)) type = "MTG";
      out.push({ key: "m" + idx, text: l, typeText: type });
    }
  });
  return out;
}
