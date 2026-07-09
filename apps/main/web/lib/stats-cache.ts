import { getRedisClient } from "./redis-client";
import type { createSupabaseServerClient } from "@account-books/supabase-client";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// [S-3-6] item_stats(S-3-2) 기반 상세항목 Top10 캐시 — WBS에 명시된 키 설계
// (`item_top10:{userId}:{period}`) 그대로 사용. F-3-1-3(상세항목 Top10 화면)이 아직
// 없어도, 그 화면이 그대로 가져다 쓸 수 있는 캐시 레이어를 먼저 마련해둔다.
const ITEM_TOP10_TTL_SECONDS = 300;
// F-3-1-3 후속(2026-07-09, PM 요청): 당월 외 "최근 3개월/최근 6개월" 합산 보기 추가.
const RANGE_MONTHS_OPTIONS = [3, 6] as const;

// monthsBack=1(기존 당월 보기)은 WBS 원 키 형식을 그대로 유지 — 이미 배포된 캐시/테스트와
// 하위호환. 3/6개월처럼 넓은 범위만 뒤에 구간 길이를 덧붙여 구분한다.
function itemTop10Key(userId: string, period: string, monthsBack: number): string {
  return monthsBack === 1
    ? `item_top10:${userId}:${period}`
    : `item_top10:${userId}:${period}:${monthsBack}`;
}

// month만큼 이동한 "YYYY-MM" 문자열을 반환 — page.tsx/calendar/page.tsx의 shiftPeriod와 동일한
// 계산 방식(음수도 허용해 과거 방향 이동에도 재사용).
function shiftPeriod(period: string, months: number): string {
  const parts = period.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const shifted = new Date(year, month - 1 + months, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

// endPeriod를 포함해 과거 방향으로 monthsBack개월치 "YYYY-MM" 집합을 만든다(예: endPeriod="2026-07",
// monthsBack=3 → {2026-05, 2026-06, 2026-07}). get_item_stats(p_period=null)로 받아온 전체 기간
// 응답 중 이 윈도우에 속하는 행만 걸러내는 데 사용 — F-3-1-4(단가 분석)가 이미 쓰는 "전체 기간을
// 한 번에 받아 JS에서 버킷팅"과 동일한 패턴.
function periodsInWindow(endPeriod: string, monthsBack: number): Set<string> {
  const periods = new Set<string>();
  for (let i = 0; i < monthsBack; i++) {
    periods.add(shiftPeriod(endPeriod, -i));
  }
  return periods;
}

export interface ItemTop10Entry {
  itemId: string;
  totalAmount: number;
  transactionCount: number;
  avgAmount: number;
}

// 캐시에 있으면 그대로 반환(MV/RPC 재조회 없음), 없으면 get_item_stats RPC로 채운 뒤 캐싱.
// monthsBack=1이면 RPC에 정확한 월을 넘겨 해당 월 행만 받아오고(기존 동작 그대로), 그보다 넓은
// 범위는 RPC를 p_period=null(전체 기간)로 호출한 뒤 필요한 윈도우만 필터링해 item_id별로 합산한다.
export async function getItemTop10(
  supabase: SupabaseServerClient,
  userId: string,
  period: string,
  monthsBack: number = 1
): Promise<ItemTop10Entry[]> {
  const redis = getRedisClient();
  const key = itemTop10Key(userId, period, monthsBack);

  const cached = await redis.get<ItemTop10Entry[]>(key);
  if (cached) return cached;

  const { data } = await supabase.rpc(
    "get_item_stats",
    monthsBack === 1 ? { p_period: period } : {}
  );
  const rows =
    monthsBack === 1
      ? (data ?? [])
      : (data ?? []).filter((row) => periodsInWindow(period, monthsBack).has(row.period ?? ""));

  const totalsByItem = new Map<string, { totalAmount: number; transactionCount: number }>();
  for (const row of rows) {
    const itemId = row.item_id ?? "";
    const prev = totalsByItem.get(itemId) ?? { totalAmount: 0, transactionCount: 0 };
    totalsByItem.set(itemId, {
      totalAmount: prev.totalAmount + (row.total_amount ?? 0),
      transactionCount: prev.transactionCount + (row.transaction_count ?? 0),
    });
  }

  const top10 = Array.from(totalsByItem.entries())
    .map(([itemId, agg]) => ({
      itemId,
      totalAmount: agg.totalAmount,
      transactionCount: agg.transactionCount,
      avgAmount: agg.transactionCount > 0 ? agg.totalAmount / agg.transactionCount : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);

  await redis.set(key, top10, { ex: ITEM_TOP10_TTL_SECONDS });
  return top10;
}

// 지출 등록/수정/삭제(F-1-5-11/14) 시점에 해당 사용자·기간의 캐시를 지운다 — MV는 트리거(S-3-4)로
// 실시간 갱신되지만 Redis 캐시는 TTL(5분)까지 그대로 남아있어 별도로 무효화해야 한다. 상세항목이
// 있는지 여부와 무관하게 항상 호출해도 안전(대상 키가 없으면 DEL은 그냥 no-op).
// monthsBack별 캐시가 늘어나면서(당월/3개월/6개월), 바뀐 period 하나가 "그 달을 포함하는" 3개월/
// 6개월 윈도우 여러 개에 걸쳐 있을 수 있음 — 그 윈도우들의 endPeriod(바뀐 달 ~ 바뀐 달+구간-1)까지
// 전부 무효화해야 예산/캘린더와 동일한 "즉시 반영" 원칙을 지킬 수 있다.
export async function invalidateItemTop10Cache(userId: string, period: string): Promise<void> {
  const redis = getRedisClient();
  const keys = [itemTop10Key(userId, period, 1)];
  for (const monthsBack of RANGE_MONTHS_OPTIONS) {
    for (let i = 0; i < monthsBack; i++) {
      keys.push(itemTop10Key(userId, shiftPeriod(period, i), monthsBack));
    }
  }
  await Promise.all(keys.map((key) => redis.del(key)));
}
