// 入力候補サジェスト（D-031）の純粋ロジックのテスト。

import { describe, expect, it } from "vitest";
import { activeToken, applySuggestion, suggestFor } from "./suggest";
import type { Project } from "../types";

const projects: Project[] = [
  { id: "p1", name: "ECサイト", color: "#1a73e8" },
  { id: "p2", name: "顧客A 保守", color: "#1e8e3e" },
];

const base = new Date(2026, 7, 3);

/** テスト用: 末尾にカーソルがある想定でトークンを取る。 */
function tokenAtEnd(text: string) {
  return activeToken(text, text.length);
}

describe("activeToken", () => {
  it("カーソル直前が記法トークンなら kind と query を返す", () => {
    expect(tokenAtEnd("A @明")).toMatchObject({ kind: "@", query: "明" });
    expect(tokenAtEnd("A #顧")).toMatchObject({ kind: "#", query: "顧" });
    expect(tokenAtEnd("A !")).toMatchObject({ kind: "!", query: "" });
  });

  it("トークン外（空白の後）なら null", () => {
    expect(tokenAtEnd("A @明日 ")).toBeNull();
    expect(tokenAtEnd("ふつうの本文")).toBeNull();
  });

  it("全角プレフィックスも半角 kind に正規化する", () => {
    expect(tokenAtEnd("A ＠明")).toMatchObject({ kind: "@", query: "明" });
  });

  it("query はカーソルまで、end はトークン末尾まで（途中カーソルでも置換範囲は全体）", () => {
    const text = "A @明日 B";
    const t = activeToken(text, 4); // "@明" の直後
    expect(t).toMatchObject({ kind: "@", query: "明", start: 2, end: 5 });
    expect(text.slice(t!.start, t!.end)).toBe("@明日");
  });

  it("直前のトークンが別プレフィックスで終わっていれば新しいトークンになる", () => {
    expect(tokenAtEnd("A @明日#EC")).toMatchObject({ kind: "#", query: "EC" });
  });
});

describe("suggestFor", () => {
  it("@（query 空）で相対日と曜日の候補が出る", () => {
    const items = suggestFor(tokenAtEnd("A @")!, projects, base);
    const labels = items.map((s) => s.label);
    expect(labels.slice(0, 5)).toEqual(["今日", "明日", "明後日", "今週末", "来週"]);
    expect(labels).toContain("金曜");
    // 実際の日付がヒントに出る。
    expect(items.find((s) => s.label === "明日")?.hint).toBe("8/4");
  });

  it("@明 で前方一致に絞られる", () => {
    const labels = suggestFor(tokenAtEnd("A @明")!, projects, base).map((s) => s.label);
    expect(labels).toEqual(["明日", "明後日"]);
  });

  it("@15 は時刻と N 日後の両方を候補に出す", () => {
    const items = suggestFor(tokenAtEnd("A @15")!, projects, base);
    expect(items.some((s) => s.insert === "@15:00")).toBe(true);
    expect(items.some((s) => s.insert === "@+15d")).toBe(true);
  });

  it("@8/10 は日付として解釈した候補を出す", () => {
    const items = suggestFor(tokenAtEnd("A @8/10")!, projects, base);
    expect(items[0]).toMatchObject({ label: "8/10", insert: "@8/10" });
  });

  it("# はプロジェクト候補（前方一致が先頭・色つき）", () => {
    const all = suggestFor(tokenAtEnd("A #")!, projects, base);
    expect(all.map((s) => s.label)).toEqual(["ECサイト", "顧客A 保守"]);
    expect(all[0].color).toBe("#1a73e8");
    const filtered = suggestFor(tokenAtEnd("A #顧")!, projects, base);
    expect(filtered.map((s) => s.label)).toEqual(["顧客A 保守"]);
    // insert は空白を除いた名前（トークンが途中で切れないように）。
    expect(filtered[0].insert).toBe("#顧客A保守");
  });

  it("! は 高 / 中 / 低", () => {
    expect(suggestFor(tokenAtEnd("A !")!, projects, base).map((s) => s.label)).toEqual(["高", "中", "低"]);
    expect(suggestFor(tokenAtEnd("A !中")!, projects, base).map((s) => s.label)).toEqual(["中"]);
  });

  it("一致しない入力では候補が空になる", () => {
    expect(suggestFor(tokenAtEnd("A @zzz")!, projects, base)).toEqual([]);
    expect(suggestFor(tokenAtEnd("A #未登録")!, projects, base)).toEqual([]);
  });
});

describe("applySuggestion", () => {
  it("トークンを置換し、後ろに空白を足してカーソルをその後ろへ置く", () => {
    const text = "設計レビュー @明";
    const r = applySuggestion(text, tokenAtEnd(text)!, "@明日");
    expect(r.text).toBe("設計レビュー @明日 ");
    expect(r.caret).toBe(r.text.length);
  });

  it("トークンの途中にカーソルがあってもトークン全体を置換する", () => {
    const text = "A @明日 B";
    const t = activeToken(text, 4);
    const r = applySuggestion(text, t!, "@明後日");
    expect(r.text).toBe("A @明後日 B");
    // 後ろに既に空白があるので足さず、カーソルは挿入語の直後。
    expect(r.caret).toBe("A @明後日".length);
  });

  it("後ろが既に空白なら二重に足さない", () => {
    const text = "A @明 B";
    const t = activeToken(text, 4);
    const r = applySuggestion(text, t!, "@明日");
    expect(r.text).toBe("A @明日 B");
  });
});
