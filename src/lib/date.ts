// 日付ユーティリティ。プロトタイプ（Wish.dc.html）のロジックを忠実に移植しつつ、
// 「今日」は固定値ではなく実時刻ベースにして実用アプリとして成立させている。

export const WD = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** アプリ全体で参照する「今日」（0:00 正規化）。 */
export function today(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

/** 任意の日付入力を 0:00 正規化した Date に。 */
export function dateOnly(x: Date | string): Date {
  const y = new Date(x);
  y.setHours(0, 0, 0, 0);
  return y;
}

/** 今日との日数差（正=未来 / 負=過去）。 */
export function diffDays(x: Date | string, base: Date = today()): number {
  return Math.round((dateOnly(x).getTime() - base.getTime()) / 86400000);
}

/** 締切ラベル（今日 / 明日 / 明後日 / 金曜 / 昨日 / N日前 / M/D）。 */
export function fmtDue(x: string | null, base: Date = today()): string | null {
  if (!x) return null;
  const n = diffDays(x, base);
  if (n === 0) return "今日";
  if (n === 1) return "明日";
  if (n === 2) return "明後日";
  if (n > 2 && n < 7) return WD[new Date(x).getDay()] + "曜";
  if (n === -1) return "昨日";
  if (n < 0) return Math.abs(n) + "日前";
  const dt = new Date(x);
  return dt.getMonth() + 1 + "/" + dt.getDate();
}

/** 締切の温度感カラー（過ぎている=赤 / 近い=橙 / 通常=グレー）。 */
export function dueColor(x: string | null, base: Date = today()): string {
  if (!x) return "#80868b";
  const n = diffDays(x, base);
  if (n <= 0) return "#d93025";
  if (n <= 3) return "#b06000";
  return "#3c4043";
}

/** 次に来る曜日（dow: 0=日〜6=土）の日付。 */
export function nextWeekday(dow: number, base: Date = today()): Date {
  let n = (dow - base.getDay() + 7) % 7;
  if (n === 0) n = 7;
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

/** 今日から n 日後。 */
export function addDays(n: number, base: Date = today()): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

/** メモ日付の表示（今日 / 昨日 / M月D日）。 */
export function fmtMemoDate(x: string, base: Date = today()): string {
  const n = diffDays(x, base);
  if (n === 0) return "今日";
  if (n === -1) return "昨日";
  const dt = new Date(x);
  return dt.getMonth() + 1 + "月" + dt.getDate() + "日";
}

/** ヘッダー用の「M月D日 X曜日」。 */
export function fmtHeaderDate(base: Date = today()): string {
  return base.getMonth() + 1 + "月" + base.getDate() + "日 " + WD[base.getDay()] + "曜日";
}
