export type Priority = "high" | "med" | "low";
export type ViewId = "today" | "inbox" | "memos" | "dashboard" | "archive" | "settings" | string;

export interface Task {
  id: string;
  title: string;
  /** プロジェクト ID。受信トレイの未仕分けタスクは null。 */
  project: string | null;
  pri: Priority;
  /** 締切日（時刻なし、0:00 正規化）。ISO 文字列で保存。 */
  due: string | null;
  /** 時間指定タスクの "HH:MM"。 */
  time: string | null;
  done: boolean;
  /** 完了日時の ISO 文字列。 */
  doneAt?: string | null;
  /** 受信トレイ（未仕分け）フラグ。 */
  inbox: boolean;
  /** タスクごとのメモ。 */
  notes: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
}

export interface Memo {
  id: string;
  text: string;
  /** 作成日の ISO 文字列。 */
  createdAt: string;
}

export interface Settings {
  /** クイック起動（グローバルホットキー）。 */
  open: string;
  /** アプリ内コマンドパレット。 */
  add: string;
  weekStart: "月" | "日";
  defaultProject: string;
  notifyDue: boolean;
  notifyDaily: boolean;
  /** デスクトップ自動起動（既定 false）。OS の自動起動エントリと同期する（正は OS 側）。 */
  autostart: boolean;
}

export type PaletteMode = "task" | "memo";

/** クイック入力 / コマンドパレットの自然言語解析結果。 */
export interface ParseResult {
  title: string;
  due: string | null;
  time: string | null;
  project: string | null;
  pri: Priority | null;
}
