// date.ts の純粋関数のユニットテスト。base を明示して実時刻に依存させない。
import { describe, it, expect } from "vitest";
import { endOfWeek } from "./date";

describe("endOfWeek（今週末判定）", () => {
  // 2026-06-30 は火曜日（Sun=0 換算で 2）。
  const tue = new Date(2026, 5, 30);

  it("月曜始まり → 週末は日曜（火曜基準で 2026-07-05）", () => {
    const e = endOfWeek("月", tue);
    expect(e.getDay()).toBe(0); // 日曜
    expect(e.getMonth()).toBe(6); // 7月
    expect(e.getDate()).toBe(5);
  });

  it("日曜始まり → 週末は土曜（火曜基準で 2026-07-04）", () => {
    const e = endOfWeek("日", tue);
    expect(e.getDay()).toBe(6); // 土曜
    expect(e.getMonth()).toBe(6);
    expect(e.getDate()).toBe(4);
  });

  it("当日が週末なら当日を返す（月曜始まりの日曜 2026-07-05）", () => {
    const sun = new Date(2026, 6, 5);
    const e = endOfWeek("月", sun);
    expect(e.getMonth()).toBe(6);
    expect(e.getDate()).toBe(5);
  });

  it("0:00 に正規化される", () => {
    const e = endOfWeek("月", new Date(2026, 5, 30, 14, 22, 33));
    expect(e.getHours()).toBe(0);
    expect(e.getMinutes()).toBe(0);
    expect(e.getSeconds()).toBe(0);
  });
});
