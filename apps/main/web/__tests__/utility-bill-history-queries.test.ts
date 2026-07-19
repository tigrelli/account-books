import { describe, it, expect } from "vitest";
import {
  getUtilityBillHistoryPanels,
  getEarliestUtilityBillPeriod,
} from "../lib/utility-bill-history-queries";

// stats-cache.test.ts와 동일하게, from(table).select(...).조건들...만 흉내낸 가벼운 스텁.
// [2026-07-19] 월 분류가 period(OCR 청구월)에서 transaction.occurred_at(지출일) 기준으로
// 바뀌면서 필터링은 전부 JS 쪽에서 하므로, 조건 없이 항상 같은 배열을 반환해도 충분하다.
type SupabaseStub = Parameters<typeof getUtilityBillHistoryPanels>[0];

function fakeSupabase(response: unknown): SupabaseStub {
  const chainMethods = ["select", "in", "order", "limit"] as const;
  return {
    from: () => {
      const builder: Record<string, unknown> = {};
      for (const method of chainMethods) builder[method] = () => builder;
      builder.maybeSingle = () => Promise.resolve({ data: response ?? null });
      builder.then = (resolve: (v: { data: unknown }) => unknown) =>
        resolve({ data: response ?? null });
      return builder;
    },
  } as unknown as SupabaseStub;
}

describe("getUtilityBillHistoryPanels", () => {
  it("UPLOAD 레코드는 raw_payload의 items를 그대로 반환한다(청구월=지출일과 같으면 billedPeriod는 null)", async () => {
    const supabase = fakeSupabase([
      {
        period: "2026-07",
        source: "UPLOAD",
        transaction: {
          amount: 165600,
          occurred_at: "2026-07-15",
          raw_payload: {
            period: "2026-07",
            total: 165600,
            usageTable: [],
            items: [{ label: "보험료", amount: 2550, section: "부가세제외항목" }],
          },
        },
      },
    ]);

    const result = await getUtilityBillHistoryPanels(supabase, ["2026-07"]);

    expect(result.get("2026-07")).toEqual({
      period: "2026-07",
      source: "UPLOAD",
      total: 165600,
      items: [{ label: "보험료", amount: 2550, section: "부가세제외항목" }],
      billedPeriod: null,
    });
  });

  it("청구월(period)과 지출일의 달이 다르면 지출일 기준 달에 표시하고 billedPeriod로 청구월을 함께 내려준다", async () => {
    // 3월분 명세서를 4월 26일 지출로 등록한 경우.
    const supabase = fakeSupabase([
      {
        period: "2026-03",
        source: "UPLOAD",
        transaction: {
          amount: 176890,
          occurred_at: "2026-04-26",
          raw_payload: { period: "2026-03", total: 176890, usageTable: [], items: [] },
        },
      },
    ]);

    const result = await getUtilityBillHistoryPanels(supabase, ["2026-04"]);

    expect(result.get("2026-03")).toBeUndefined();
    expect(result.get("2026-04")).toEqual({
      period: "2026-04",
      source: "UPLOAD",
      total: 176890,
      items: [],
      billedPeriod: "2026-03",
    });
  });

  it("MANUAL 레코드는 raw_payload가 없어 items가 빈 배열이다", async () => {
    const supabase = fakeSupabase([
      {
        period: "2026-06",
        source: "MANUAL",
        transaction: { amount: 50000, occurred_at: "2026-06-10", raw_payload: null },
      },
    ]);

    const result = await getUtilityBillHistoryPanels(supabase, ["2026-06"]);

    expect(result.get("2026-06")).toEqual({
      period: "2026-06",
      source: "MANUAL",
      total: 50000,
      items: [],
      billedPeriod: null,
    });
  });

  it("요청한 달 중 등록이 없는 달은 맵에 키 자체가 없다", async () => {
    const supabase = fakeSupabase([]);

    const result = await getUtilityBillHistoryPanels(supabase, ["2026-05"]);

    expect(result.has("2026-05")).toBe(false);
  });
});

describe("getEarliestUtilityBillPeriod", () => {
  it("등록된 레코드가 있으면 가장 이른 지출일의 달을 반환한다", async () => {
    const supabase = fakeSupabase([
      { transaction: { occurred_at: "2026-03-10" } },
      { transaction: { occurred_at: "2026-01-05" } },
      { transaction: { occurred_at: "2026-02-20" } },
    ]);

    const result = await getEarliestUtilityBillPeriod(supabase);

    expect(result).toBe("2026-01");
  });

  it("등록된 레코드가 없으면 null을 반환한다", async () => {
    const supabase = fakeSupabase([]);

    const result = await getEarliestUtilityBillPeriod(supabase);

    expect(result).toBeNull();
  });
});
