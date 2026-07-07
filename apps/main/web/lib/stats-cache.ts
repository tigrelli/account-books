import { getRedisClient } from "./redis-client";
import type { createSupabaseServerClient } from "@account-books/supabase-client";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// [S-3-6] item_stats(S-3-2) 기반 상세항목 Top10 캐시 — WBS에 명시된 키 설계
// (`item_top10:{userId}:{period}`) 그대로 사용. F-3-1-3(상세항목 Top10 화면)이 아직
// 없어도, 그 화면이 그대로 가져다 쓸 수 있는 캐시 레이어를 먼저 마련해둔다.
const ITEM_TOP10_TTL_SECONDS = 300;

function itemTop10Key(userId: string, period: string): string {
  return `item_top10:${userId}:${period}`;
}

export interface ItemTop10Entry {
  itemId: string;
  totalAmount: number;
  transactionCount: number;
  avgAmount: number;
}

// 캐시에 있으면 그대로 반환(MV/RPC 재조회 없음), 없으면 get_item_stats RPC로 채운 뒤 캐싱.
export async function getItemTop10(
  supabase: SupabaseServerClient,
  userId: string,
  period: string
): Promise<ItemTop10Entry[]> {
  const redis = getRedisClient();
  const key = itemTop10Key(userId, period);

  const cached = await redis.get<ItemTop10Entry[]>(key);
  if (cached) return cached;

  const { data } = await supabase.rpc("get_item_stats", { p_period: period });
  const top10 = (data ?? [])
    .map((row) => ({
      itemId: row.item_id ?? "",
      totalAmount: row.total_amount ?? 0,
      transactionCount: row.transaction_count ?? 0,
      avgAmount: row.avg_amount ?? 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);

  await redis.set(key, top10, { ex: ITEM_TOP10_TTL_SECONDS });
  return top10;
}

// 지출 등록/수정/삭제(F-1-5-11/14) 시점에 해당 사용자·기간의 캐시를 지운다 — MV는 트리거(S-3-4)로
// 실시간 갱신되지만 Redis 캐시는 TTL(5분)까지 그대로 남아있어 별도로 무효화해야 한다. 상세항목이
// 있는지 여부와 무관하게 항상 호출해도 안전(대상 키가 없으면 DEL은 그냥 no-op).
export async function invalidateItemTop10Cache(userId: string, period: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(itemTop10Key(userId, period));
}
