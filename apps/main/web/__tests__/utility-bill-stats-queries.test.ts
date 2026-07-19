import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getUtilityBillTotalTrend,
  getUtilityBillItemTrend,
  getUtilityBillChangeRate,
  getUtilityBillLatestItemBreakdown,
  TOP_CHANGED_ITEM_LIMIT,
} from "../lib/utility-bill-stats-queries";

// 각 함수가 실제로 필요로 하는 부분(from(table).select(...).조건들...)만 흉내낸 스텁 —
// stats-cache.test.ts의 fakeSupabase와 동일 원칙. 함수당 테이블 조회가 1회뿐이라
// utility-bill-actions.test.ts처럼 테이블별 큐를 둘 필요는 없음.
type SupabaseStub = Parameters<typeof getUtilityBillTotalTrend>[0];

function fakeSupabase(responses: Record<string, unknown>): SupabaseStub {
  const chainMethods = ["select", "gte", "lte", "order", "eq", "in"] as const;
  return {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of chainMethods) {
        builder[method] = () => builder;
      }
      builder.maybeSingle = () => Promise.resolve({ data: responses[table] ?? null });
      builder.then = (resolve: (v: { data: unknown }) => unknown) =>
        resolve({ data: responses[table] ?? null });
      return builder;
    },
  } as unknown as SupabaseStub;
}

describe("getUtilityBillTotalTrend", () => {
  it("과거 연도는 12개월 전부 반환하고, 미등록 달은 0원/isManual=false로 채운다", async () => {
    const supabase = fakeSupabase({
      utility_bill_record: [
        { period: "2025-03", source: "UPLOAD", transaction: { amount: 50000 } },
        { period: "2025-07", source: "MANUAL", transaction: { amount: 30000 } },
      ],
    });

    const result = await getUtilityBillTotalTrend(supabase, "2025");

    expect(result).toHaveLength(12);
    expect(result[0]).toEqual({ period: "2025-01", total: 0, isManual: false });
    expect(result[2]).toEqual({ period: "2025-03", total: 50000, isManual: false });
    expect(result[6]).toEqual({ period: "2025-07", total: 30000, isManual: true });
  });

  it("올해는 이번 달까지만, 미래 연도는 빈 배열을 반환한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 18)); // 2026-07-18
    try {
      const supabase = fakeSupabase({ utility_bill_record: [] });

      const currentYear = await getUtilityBillTotalTrend(supabase, "2026");
      expect(currentYear).toHaveLength(7); // 1~7월

      const futureYear = await getUtilityBillTotalTrend(supabase, "2027");
      expect(futureYear).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("getUtilityBillItemTrend", () => {
  it("활성 항목이 없으면 빈 결과를 반환한다", async () => {
    const supabase = fakeSupabase({ utility_bill_item: [] });

    const result = await getUtilityBillItemTrend(supabase, "2025");

    expect(result).toEqual({ items: [], points: [], totalActiveItemCount: 0 });
  });

  it("항목별 월별 금액을 채우고, 그 달에 값이 없는 항목은 0이 아니라 null로 둔다", async () => {
    const supabase = fakeSupabase({
      utility_bill_item: [
        { id: "item-1", name: "일반관리비" },
        { id: "item-2", name: "전기료" },
      ],
      utility_bill_record: [
        {
          period: "2025-03",
          item_values: [{ item_id: "item-1", amount: 10000 }],
        },
      ],
    });

    const result = await getUtilityBillItemTrend(supabase, "2025");

    expect(result.totalActiveItemCount).toBe(2);
    const march = result.points.find((p) => p.period === "2025-03");
    expect(march?.values).toEqual({ "item-1": 10000, "item-2": null });
    const jan = result.points.find((p) => p.period === "2025-01");
    expect(jan?.values).toEqual({ "item-1": null, "item-2": null });
  });

  it("활성 항목이 5개 초과면 최근 3개월 변화폭이 큰 상위 5개만 반환한다", async () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: `item-${i}`, name: `항목${i}` }));
    // item-5만 최근 3개월(2025-10~12) 변화폭이 크게(100→10000) 설계, 나머지는 매달 1000원 고정.
    const records = ["2025-10", "2025-11", "2025-12"].map((period, i) => ({
      period,
      item_values: [
        ...items.slice(0, 5).map((item) => ({ item_id: item.id, amount: 1000 })),
        ...(i === 0 ? [{ item_id: "item-5", amount: 100 }] : []),
        ...(i === 2 ? [{ item_id: "item-5", amount: 10000 }] : []),
      ],
    }));
    const supabase = fakeSupabase({
      utility_bill_item: items,
      utility_bill_record: records,
    });

    const result = await getUtilityBillItemTrend(supabase, "2025");

    expect(result.totalActiveItemCount).toBe(6);
    expect(result.items).toHaveLength(TOP_CHANGED_ITEM_LIMIT);
    expect(result.items.some((item) => item.id === "item-5")).toBe(true);
  });
});

describe("getUtilityBillChangeRate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 18)); // 2026-07-18 → 이번 달 2026-07, 전월 2026-06
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("이번 달/전월 총액과 증감률을 계산한다", async () => {
    const supabase = fakeSupabase({
      utility_bill_record: [
        { period: "2026-06", transaction: { amount: 100000 } },
        { period: "2026-07", transaction: { amount: 130000 } },
      ],
    });

    const result = await getUtilityBillChangeRate(supabase);

    expect(result).toEqual({
      currentPeriod: "2026-07",
      previousPeriod: "2026-06",
      currentTotal: 130000,
      previousTotal: 100000,
      changeRate: 0.3,
    });
  });

  it("이번 달 또는 전월 데이터가 없으면 changeRate는 null이다", async () => {
    const supabase = fakeSupabase({
      utility_bill_record: [{ period: "2026-07", transaction: { amount: 130000 } }],
    });

    const result = await getUtilityBillChangeRate(supabase);

    expect(result.previousTotal).toBeNull();
    expect(result.changeRate).toBeNull();
  });

  it("전월 총액이 0이면 나눗셈이 무의미해 changeRate는 null이다", async () => {
    const supabase = fakeSupabase({
      utility_bill_record: [
        { period: "2026-06", transaction: { amount: 0 } },
        { period: "2026-07", transaction: { amount: 130000 } },
      ],
    });

    const result = await getUtilityBillChangeRate(supabase);

    expect(result.changeRate).toBeNull();
  });
});

describe("getUtilityBillLatestItemBreakdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 18)); // 2026-07-18 → 이번 달 2026-07
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("이번 달 등록이 없으면 빈 배열을 반환한다", async () => {
    const supabase = fakeSupabase({ utility_bill_record: null });

    const result = await getUtilityBillLatestItemBreakdown(supabase);

    expect(result).toEqual([]);
  });

  it("이번 달 항목별 비중을 금액 내림차순으로 반환한다", async () => {
    const supabase = fakeSupabase({
      utility_bill_record: {
        item_values: [
          { item_id: "item-1", amount: 10000, item: { name: "일반관리비" } },
          { item_id: "item-2", amount: 50000, item: { name: "전기료" } },
        ],
      },
    });

    const result = await getUtilityBillLatestItemBreakdown(supabase);

    expect(result).toEqual([
      { itemId: "item-2", itemName: "전기료", amount: 50000 },
      { itemId: "item-1", itemName: "일반관리비", amount: 10000 },
    ]);
  });
});
