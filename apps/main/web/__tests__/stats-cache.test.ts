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
    expect(redisSet).toHaveBeenCalledWith(
      "item_top10:user-1:2026-07",
      result,
      { ex: 300 } // S-3-6에 명시된 TTL(5분)
    );
  });
});

describe("invalidateItemTop10Cache", () => {
  it("WBS에 명시된 키 형식(item_top10:{userId}:{period}) 그대로 삭제한다", async () => {
    await invalidateItemTop10Cache("user-42", "2026-08");
    expect(redisDel).toHaveBeenCalledWith("item_top10:user-42:2026-08");
  });

  it("캐시에 없는 키를 지워도 예외 없이 끝난다(no-op)", async () => {
    redisDel.mockResolvedValue(0);
    await expect(invalidateItemTop10Cache("user-99", "2026-01")).resolves.toBeUndefined();
  });
});
