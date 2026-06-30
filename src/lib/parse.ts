// 自然言語タスク解析。プロトタイプの parse() を忠実に移植。
// 例: 「明日15時 設計レビュー #ECサイト !高」→ 日付 / 時刻 / 優先度 / プロジェクト

import type { ParseResult, Project } from "../types";
import { WD, addDays, nextWeekday, today } from "./date";

export function parse(str: string, projects: Project[], base: Date = today()): ParseResult {
  let s = " " + str + " ";
  const r: ParseResult = { title: "", due: null, time: null, project: null, pri: null };

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
