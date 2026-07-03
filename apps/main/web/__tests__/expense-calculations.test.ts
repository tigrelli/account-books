import { describe, it, expect } from "vitest";
import { sumDetailAmounts } from "../lib/expense-calculations";

describe("sumDetailAmounts", () => {
  it("상세항목이 없으면 0을 반환한다", () => {
    expect(sumDetailAmounts([])).toBe(0);
  });

  it("여러 상세항목의 금액을 합산한다", () => {
    expect(sumDetailAmounts([{ amount: "1000" }, { amount: "2500" }, { amount: "500" }])).toBe(
      4000
    );
  });

  it("입력 중인 빈 값은 0으로 취급해 합산한다", () => {
    expect(sumDetailAmounts([{ amount: "1000" }, { amount: "" }])).toBe(1000);
  });

  it("숫자가 아닌 값은 0으로 취급해 합산한다", () => {
    expect(sumDetailAmounts([{ amount: "1000" }, { amount: "abc" }])).toBe(1000);
  });
});
