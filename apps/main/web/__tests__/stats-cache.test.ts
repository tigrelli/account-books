import { describe, it, expect, vi, beforeEach } from "vitest";
import { getItemTop10, invalidateItemTop10Cache } from "../lib/stats-cache";

const redisGet = vi.fn();
const redisSet = vi.fn();
const redisDel = vi.fn();

vi.mock("../lib/redis-client", () => ({
  getRedisClient: () => ({ get: redisGet, set: redisSet, del: redisDel }),
}));

// getItemTop10이 실제로 필요로 하는 부분(supabase.rpc)만 흉내낸 스텁 — 타입 전체를 만들 필요 없음.
function fakeSupabase(rpcData: unknown) {
  const rpc = vi.fn().mockResolvedValue({ data: rpcData });
  return { rpc } as unknown as Parameters<typeof getItemTop10>[0];
}

beforeEach(() => {
  redisGet.mockReset();
  redisSet.mockReset();
  redisDel.mockReset();
});

describe("getItemTop10", () => {
  it("캐시 히트 시 RPC를 호출하지 않고 캐시된 값을 그대로 반환한다", async () => {
    const cached = [{ itemId: "a", totalAmount: 1000, transactionCount: 1, avgAmount: 1000 }];
    redisGet.mockResolvedValue(cached);
    const supabase = fakeSupabase([]);

    const result = await getItemTop10(supabase, "user-1", "2026-07");

    expect(result).toBe(cached);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("캐시 미스 시 RPC로 계산한 뒤 상위 10개만 금액 내림차순으로 정렬해 캐싱하고 반환한다", async () => {
    redisGet.mockResolvedValue(null);
    const rpcRows = Array.from({ length: 12 }, (_, i) => ({
      item_id: `item-${i}`,
      total_amount: i * 100,
      transaction_count: 1,
      avg_amount: i * 100,
    }));
    const supabase = fakeSupabase(rpcRows);

    const result = await getItemTop10(supabase, "user-1", "2026-07");

    expect(result).toHaveLength(10);
    expect(result[0]?.itemId).toBe("item-11"); // 금액 최대(1100)가 1위
    expect(result[0]?.totalAmount).toBe(1100);
    expect(supabase.rpc).toHaveBeenCalledWith("get_item_stats", { p_period: "2026-07" });
    expect(redisSet).toHaveBeenCalledWith(
      "item_top10:user-1:2026-07",
      result,
      { ex: 300 } // S-3-6에 명시된 TTL(5분)
    );
  });

  // F-3-1-3 후속(2026-07-09): 당월 외 "최근 N개월" 합산 보기 — RPC는 전체 기간(p_period 생략)으로
  // 한 번만 호출하고, 필요한 개월만 JS에서 필터링해 item_id별로 합산해야 한다.
  it("monthsBack>1이면 RPC를 전체 기간으로 한 번 호출해 지정한 개월수만 item별로 합산한다", async () => {
    redisGet.mockResolvedValue(null);
    const rpcRows = [
      {
        item_id: "onion",
        total_amount: 2000,
        transaction_count: 1,
        avg_amount: 2000,
        period: "2026-05",
      },
      {
        item_id: "onion",
        total_amount: 3000,
        transaction_count: 2,
        avg_amount: 1500,
        period: "2026-06",
      },
      {
        item_id: "onion",
        total_amount: 4000,
        transaction_count: 1,
        avg_amount: 4000,
        period: "2026-07",
      },
      // 윈도우(2026-05~2026-07) 밖 데이터 — 합산에서 제외돼야 함.
      {
        item_id: "onion",
        total_amount: 9999,
        transaction_count: 1,
        avg_amount: 9999,
        period: "2026-04",
      },
      {
        item_id: "carrot",
        total_amount: 500,
        transaction_count: 1,
        avg_amount: 500,
        period: "2026-07",
      },
    ];
    const supabase = fakeSupabase(rpcRows);

    const result = await getItemTop10(supabase, "user-1", "2026-07", 3);

    expect(supabase.rpc).toHaveBeenCalledWith("get_item_stats", {});
    const onion = result.find((r) => r.itemId === "onion");
    expect(onion?.totalAmount).toBe(9000); // 4월 9999 제외, 5~7월 2000+3000+4000
    expect(onion?.transactionCount).toBe(4);
    expect(onion?.avgAmount).toBe(2250); // 9000/4
    expect(redisSet).toHaveBeenCalledWith("item_top10:user-1:2026-07:3", result, { ex: 300 });
  });
});

describe("invalidateItemTop10Cache", () => {
  it("WBS에 명시된 키 형식(item_top10:{userId}:{period}) 그대로 삭제한다", async () => {
    await invalidateItemTop10Cache("user-42", "2026-08");
    expect(redisDel).toHaveBeenCalledWith("item_top10:user-42:2026-08");
  });

  // F-3-1-3 후속: 최근 3/6개월 캐시가 추가되면서, 바뀐 달(2026-08) 하나가 그 달을 포함하는 여러
  // 3/6개월 윈도우(endPeriod가 2026-08~2026-10, 2026-08~2027-01)에 걸쳐 있을 수 있어 그 변형들도
  // 함께 삭제해야 "즉시 반영" 원칙이 지켜진다.
  it("3개월/6개월 범위 캐시도 바뀐 달을 포함하는 endPeriod 변형까지 전부 삭제한다", async () => {
    await invalidateItemTop10Cache("user-42", "2026-08");

    expect(redisDel).toHaveBeenCalledWith("item_top10:user-42:2026-08:3");
    expect(redisDel).toHaveBeenCalledWith("item_top10:user-42:2026-09:3");
    expect(redisDel).toHaveBeenCalledWith("item_top10:user-42:2026-10:3");
    expect(redisDel).toHaveBeenCalledWith("item_top10:user-42:2026-08:6");
    expect(redisDel).toHaveBeenCalledWith("item_top10:user-42:2027-01:6");
    expect(redisDel).toHaveBeenCalledTimes(10); // 당월(1) + 3개월 변형(3) + 6개월 변형(6)
  });

  it("캐시에 없는 키를 지워도 예외 없이 끝난다(no-op)", async () => {
    redisDel.mockResolvedValue(0);
    await expect(invalidateItemTop10Cache("user-99", "2026-01")).resolves.toBeUndefined();
  });
});
