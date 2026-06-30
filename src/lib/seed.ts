// 初期サンプルデータ。プロトタイプの初期 state を移植。
// 日付は固定値ではなく「今日」起点の相対値で生成し、いつ開いてもデザイン通りに見えるようにしている。

import type { Memo, Project, Settings, Task } from "../types";
import { addDays, today } from "./date";

export function seedProjects(): Project[] {
  return [
    { id: "p1", name: "ECサイト刷新", color: "#1a73e8" },
    { id: "p2", name: "社内基盤API", color: "#12b5cb" },
    { id: "p3", name: "顧客A 保守", color: "#f9ab00" },
    { id: "p4", name: "Wish 開発", color: "#9334e6" },
  ];
}

export function seedTasks(): Task[] {
  const base = today();
  const iso = (d: Date) => d.toISOString();
  const t0 = iso(base);
  const plus = (n: number) => iso(addDays(n, base));
  let i = 0;
  const nid = () => "t" + ++i;
  return [
    { id: nid(), title: "顧客A 定例MTG", project: "p3", type: "MTG", pri: "med", due: t0, time: "09:30", done: false, inbox: false, sub: [], notes: "" },
    { id: nid(), title: "設計レビュー資料の修正", project: "p1", type: "DOC", pri: "high", due: plus(3), time: null, done: false, inbox: false, sub: [{ title: "構成の見直し", done: true }, { title: "図の差し替え", done: true }, { title: "レビュー依頼の送付", done: false }, { title: "最終チェック", done: false }], notes: "前回指摘: シーケンス図の粒度を揃える。カート周りは再設計案を反映する。" },
    { id: nid(), title: "障害報告書 提出", project: "p3", type: "DOC", pri: "high", due: t0, time: null, done: false, inbox: false, sub: [], notes: "" },
    { id: nid(), title: "認証APIのリファクタ", project: "p2", type: "開発", pri: "med", due: t0, time: null, done: false, inbox: false, sub: [], notes: "" },
    { id: nid(), title: "ER図 ドラフト作成", project: "p1", type: "設計", pri: "low", due: null, time: null, done: false, inbox: false, sub: [], notes: "" },
    { id: nid(), title: "カート再設計の方針整理", project: "p1", type: "設計", pri: "med", due: null, time: null, done: false, inbox: false, sub: [], notes: "" },
    { id: nid(), title: "商品APIの結合テスト準備", project: "p1", type: "開発", pri: "low", due: plus(4), time: null, done: false, inbox: false, sub: [], notes: "" },
    { id: nid(), title: "Wishの配色を決定", project: "p4", type: "開発", pri: "med", due: plus(2), time: null, done: false, inbox: false, sub: [], notes: "" },
    { id: nid(), title: "ホットキー仕様を整理", project: "p4", type: "設計", pri: "low", due: null, time: null, done: false, inbox: false, sub: [], notes: "" },
    { id: nid(), title: "APIスキーマ定義の見直し", project: "p2", type: "設計", pri: "med", due: null, time: null, done: false, inbox: false, sub: [], notes: "" },
    { id: nid(), title: "朝会アジェンダ作成", project: "p3", type: "DOC", pri: "low", due: t0, time: null, done: true, doneAt: t0, inbox: false, sub: [], notes: "" },
    { id: nid(), title: "デプロイ手順書の更新", project: "p2", type: "DOC", pri: "low", due: null, time: null, done: true, doneAt: t0, inbox: false, sub: [], notes: "" },
    { id: nid(), title: "障害の再発防止策を検討", project: null, type: "設計", pri: "med", due: null, time: null, done: false, inbox: true, sub: [], notes: "" },
    { id: nid(), title: "Wishのアイコン案を探す", project: null, type: "設計", pri: "low", due: null, time: null, done: false, inbox: true, sub: [], notes: "" },
  ];
}

export function seedMemos(): Memo[] {
  const base = today();
  return [
    { id: "me1", text: "認証方式、OAuth2 + Keycloak で確定。\nリフレッシュトークンの寿命は要相談。", createdAt: base.toISOString() },
    { id: "me2", text: "次の1on1で相談したいこと: 来期の担当範囲、レビュー負荷の平準化。", createdAt: addDays(-2, base).toISOString() },
  ];
}

export function seedSettings(): Settings {
  return { open: "Alt + Space", add: "Ctrl + K", weekStart: "月", defaultProject: "p1", notifyDue: true, notifyDaily: true };
}

export const SWATCHES = ["#1a73e8", "#1e8e3e", "#f9ab00", "#d93025", "#9334e6", "#12b5cb"];
