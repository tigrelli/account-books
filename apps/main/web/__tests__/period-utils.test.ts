import { describe, it, expect } from "vitest";
import { addMonthsToPeriod } from "../lib/period-utils";

describe("addMonthsToPeriod", () => {
  it("양수만큼 더하면 이후 달을 반환한다", () => {
    expect(addMonthsToPeriod("2026-07", 1)).toBe("2026-08");
  });

  it("음수만큼 더하면(빼면) 이전 달을 반환한다", () => {
    expect(addMonthsToPeriod("2026-07", -1)).toBe("2026-06");
  });

  it("연도를 넘어가는 경우(12월 다음 → 다음해 1월)도 올바르게 처리한다", () => {
    expect(addMonthsToPeriod("2026-12", 1)).toBe("2027-01");
  });

  it("연도를 거슬러 넘어가는 경우(1월 이전 → 전해 12월)도 올바르게 처리한다", () => {
    expect(addMonthsToPeriod("2026-01", -1)).toBe("2025-12");
  });

  it("delta가 0이면 같은 달을 반환한다", () => {
    expect(addMonthsToPeriod("2026-07", 0)).toBe("2026-07");
  });
});
