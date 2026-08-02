// parse()（明示プレフィックス方式 / D-031）のユニットテスト。
// 目的の中心は「裸のテキストを勝手に解釈しないこと」。

import { describe, expect, it } from "vitest";
import { parse } from "./parse";
import type { Project } from "../types";

const projects: Project[] = [
  { id: "p1", name: "ECサイト", color: "#1a73e8" },
  { id: "p2", name: "顧客A 保守", color: "#1e8e3e" },
];

/** 2026-08-03（0:00）を「今日」として固定する。 */
const base = new Date(2026, 7, 3);

/** ISO 文字列を M/D へ（期待値の読みやすさのため）。 */
function md(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getMonth() + 1 + "/" + d.getDate();
}

describe("裸のテキストは解釈しない（D-031 の誤爆防止）", () => {
  // 以前は 曜? が任意だったため「金」「日」「月」の 1 文字で曜日が付いていた。
  it.each([
    "入出金",
    "日報",
    "月次レポート",
    "火災報知器の点検",
    "水道料金の支払い",
    "土地の登記",
    "木材の発注",
  ])("%s → 日付が付かない", (input) => {
    const r = parse(input, projects, base);
    expect(r.due).toBeNull();
    expect(r.time).toBeNull();
    expect(r.title).toBe(input);
  });

  it("「3時間かかる」→ 時刻が付かない", () => {
    const r = parse("3時間かかる", projects, base);
    expect(r.time).toBeNull();
    expect(r.title).toBe("3時間かかる");
  });

  it("「1/2 に分割」→ 日付が付かない", () => {
    const r = parse("1/2 に分割", projects, base);
    expect(r.due).toBeNull();
    expect(r.title).toBe("1/2 に分割");
  });

  it("「高優先度の整理」→ 優先度が付かない（高優先の裸解釈を廃止）", () => {
    const r = parse("高優先度の整理", projects, base);
    expect(r.pri).toBeNull();
    expect(r.title).toBe("高優先度の整理");
  });

  it("裸の「明日」「金曜」「15時」も解釈しない", () => {
    const r = parse("明日 金曜 15時 資料作成", projects, base);
    expect(r.due).toBeNull();
    expect(r.time).toBeNull();
    expect(r.title).toBe("明日 金曜 15時 資料作成");
  });

  it("「まで / までに」はタイトルに残す（裸解析の名残を廃止）", () => {
    const r = parse("週末までに提出", projects, base);
    expect(r.title).toBe("週末までに提出");
  });
});

describe("@ 日付・時刻", () => {
  it("@今日 / @明日 / @明後日", () => {
    expect(md(parse("A @今日", projects, base).due)).toBe("8/3");
    expect(md(parse("A @明日", projects, base).due)).toBe("8/4");
    expect(md(parse("A @明後日", projects, base).due)).toBe("8/5");
  });

  it("@来週 は 7 日後、@+3d / @+3 は N 日後", () => {
    expect(md(parse("A @来週", projects, base).due)).toBe("8/10");
    expect(md(parse("A @+3d", projects, base).due)).toBe("8/6");
    expect(md(parse("A @+3", projects, base).due)).toBe("8/6");
  });

  it("@8/10 は月/日（不正な日付は解釈しない）", () => {
    expect(md(parse("A @8/10", projects, base).due)).toBe("8/10");
    const bad = parse("A @2/30", projects, base);
    expect(bad.due).toBeNull();
    expect(bad.title).toBe("A @2/30");
  });

  it("@金 / @金曜 / @金曜日 は次に来る金曜（今日より後・7 日以内）", () => {
    for (const tok of ["@金", "@金曜", "@金曜日"]) {
      const r = parse("A " + tok, projects, base);
      expect(r.due).not.toBeNull();
      const d = new Date(r.due as string);
      expect(d.getDay()).toBe(5); // 金曜
      const diff = Math.round((d.getTime() - base.getTime()) / 86400000);
      expect(diff).toBeGreaterThan(0);
      expect(diff).toBeLessThanOrEqual(7);
    }
  });

  it("@15:00 / @15時 / @15時30分 は時刻", () => {
    expect(parse("A @15:00", projects, base).time).toBe("15:00");
    expect(parse("A @9:30", projects, base).time).toBe("09:30");
    expect(parse("A @15時", projects, base).time).toBe("15:00");
    expect(parse("A @15時30分", projects, base).time).toBe("15:30");
  });

  it("日付と時刻を併記できる", () => {
    const r = parse("設計レビュー @明日 @15:00", projects, base);
    expect(md(r.due)).toBe("8/4");
    expect(r.time).toBe("15:00");
    expect(r.title).toBe("設計レビュー");
  });

  it("同種が複数なら最初の 1 つを採用し、残りはタイトルに残さない", () => {
    const r = parse("A @明日 @明後日", projects, base);
    expect(md(r.due)).toBe("8/4");
    expect(r.title).toBe("A");
  });

  it("解釈できない @xyz はタイトルに残す", () => {
    const r = parse("A @xyz", projects, base);
    expect(r.due).toBeNull();
    expect(r.title).toBe("A @xyz");
  });
});

describe("# プロジェクト / ! 優先度", () => {
  it("#前方一致 でプロジェクトを引く", () => {
    expect(parse("A #EC", projects, base).project).toBe("p1");
    expect(parse("A #顧客A", projects, base).project).toBe("p2");
  });

  it("プロジェクト名の空白は無視して一致する", () => {
    expect(parse("A #顧客A保守", projects, base).project).toBe("p2");
  });

  it("一致しない #未登録 はタイトルに残す", () => {
    const r = parse("A #未登録", projects, base);
    expect(r.project).toBeNull();
    expect(r.title).toBe("A #未登録");
  });

  it("!高 / !中 / !低", () => {
    expect(parse("A !高", projects, base).pri).toBe("high");
    expect(parse("A !中", projects, base).pri).toBe("med");
    expect(parse("A !低", projects, base).pri).toBe("low");
  });

  it("!不明 はタイトルに残す", () => {
    const r = parse("A !不明", projects, base);
    expect(r.pri).toBeNull();
    expect(r.title).toBe("A !不明");
  });
});

describe("組み合わせ・記法の細部", () => {
  it("すべて併記: 障害報告書 @金曜 #顧客A !高", () => {
    const r = parse("障害報告書 @金曜 #顧客A !高", projects, base);
    expect(r.due).not.toBeNull();
    expect(r.project).toBe("p2");
    expect(r.pri).toBe("high");
    expect(r.title).toBe("障害報告書");
  });

  it("全角プレフィックス（＠＃！）も受ける", () => {
    const r = parse("A ＠明日 ＃EC ！高", projects, base);
    expect(md(r.due)).toBe("8/4");
    expect(r.project).toBe("p1");
    expect(r.pri).toBe("high");
    expect(r.title).toBe("A");
  });

  it("空白なしで連結しても区切られる", () => {
    const r = parse("設計レビュー@明日#EC!高", projects, base);
    expect(md(r.due)).toBe("8/4");
    expect(r.project).toBe("p1");
    expect(r.pri).toBe("high");
    expect(r.title).toBe("設計レビュー");
  });

  it("プレフィックスのみ（入力途中）はそのまま残す", () => {
    const r = parse("設計レビュー @", projects, base);
    expect(r.due).toBeNull();
    expect(r.title).toBe("設計レビュー @");
  });
});
