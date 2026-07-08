import { describe, expect, it } from "vitest";
import { formatCurrency, formatCurrencySigned, toYearMonth } from "./format";

describe("formatCurrency", () => {
  it("금액을 원화 형식으로 변환한다", () => {
    expect(formatCurrency(1234567)).toBe("₩1,234,567");
    expect(formatCurrency(0)).toBe("₩0");
    expect(formatCurrency(100)).toBe("₩100");
  });
});

describe("formatCurrencySigned", () => {
  it("양수는 +₩ 접두사를 붙인다", () => {
    expect(formatCurrencySigned(1000)).toBe("+₩1,000");
  });

  it("음수는 -₩ 접두사를 붙인다", () => {
    expect(formatCurrencySigned(-1000)).toBe("-₩1,000");
  });
});

describe("toYearMonth", () => {
  it("날짜를 YYYY-MM 형식으로 변환한다", () => {
    expect(toYearMonth(new Date("2025-06-15"))).toBe("2025-06");
  });
});
