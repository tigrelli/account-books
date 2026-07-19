// [F-2-3-x] 명세서 통계 화면(/utility-bills/stats) 전용 집계 쿼리 — dashboard-queries.ts와
// 동일 컨벤션(supabase 클라이언트를 받는 순수 함수, RLS로 본인 데이터만 조회됨).
import type { createSupabaseServerClient } from "@account-books/supabase-client";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface UtilityBillTotalTrendPoint {
  period: string;
  total: number;
  isManual: boolean;
}

// 올해는 이번 달까지만, 지난 연도는 12개월 전부, 미래 연도는 아직 지나온 달이 없으므로 0개월.
function monthsToShow(year: string): number {
  const now = new Date();
  const requestedYear = Number(year);
  if (requestedYear < now.getFullYear()) return 12;
  if (requestedYear > now.getFullYear()) return 0;
  return now.getMonth() + 1;
}

// F-2-3-1: 지정 연도의 총액 추이(입력방식 무관 전체) — 아직 지나지 않은 미래 달은 그래프에
// 만들지 않는다(0원으로 표시하면 "이번 달까지 0원 썼다"로 오독될 수 있음). source가 'MANUAL'인
// 달은 isManual로 표시해 차트에서 배지로 구분한다(화면설계 §3-1). 지나간 달인데 등록이 안 된
// 경우는 0으로 채운다(getMonthlyTrend와 동일 컨벤션 — 미등록을 결측이 아니라 0원으로 취급).
export async function getUtilityBillTotalTrend(
  supabase: SupabaseServerClient,
  year: string
): Promise<UtilityBillTotalTrendPoint[]> {
  const monthCount = monthsToShow(year);
  if (monthCount === 0) return [];

  const { data } = await supabase
    .from("utility_bill_record")
    .select("period, source, transaction:transaction_id!inner(amount)")
    .gte("period", `${year}-01`)
    .lte("period", `${year}-${String(monthCount).padStart(2, "0")}`)
    .order("period", { ascending: true });

  const byPeriod = new Map(
    (data ?? []).map((row) => [
      row.period,
      { total: row.transaction.amount, isManual: row.source === "MANUAL" },
    ])
  );

  return Array.from({ length: monthCount }, (_, i) => {
    const period = `${year}-${String(i + 1).padStart(2, "0")}`;
    const entry = byPeriod.get(period);
    return {
      period,
      total: entry?.total ?? 0,
      isManual: entry?.isManual ?? false,
    };
  });
}

export interface UtilityBillItemTrendItem {
  id: string;
  name: string;
}

export interface UtilityBillItemTrendPoint {
  period: string;
  values: Record<string, number | null>;
}

export interface UtilityBillItemTrendResult {
  items: UtilityBillItemTrendItem[];
  points: UtilityBillItemTrendPoint[];
  totalActiveItemCount: number;
}

export const TOP_CHANGED_ITEM_LIMIT = 5;
const CHANGE_WINDOW_SIZE = 3;

// PM 요청(2026-07-18): 활성 항목이 많으면 선이 전부 겹쳐 구분이 안 돼, 최근 CHANGE_WINDOW_SIZE개월
// (연도 경계를 넘기지 않고 화면에 보이는 달 중 최근 것만) 변화폭(최대값-최소값, 값이 있는 달만
// 대상)이 큰 상위 항목만 남긴다. 활성 항목이 limit 이하면 slice가 전부를 그대로 반환하므로 별도
// 분기 없이 자연스럽게 "필터링 없음"과 동일하게 동작한다.
function topChangedItems(
  items: UtilityBillItemTrendItem[],
  points: UtilityBillItemTrendPoint[],
  limit: number
): UtilityBillItemTrendItem[] {
  const window = points.slice(-CHANGE_WINDOW_SIZE);

  const rangeByItemId = new Map<string, number>();
  for (const item of items) {
    const values = window
      .map((point) => point.values[item.id])
      .filter((value): value is number => value != null);
    const range = values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;
    rangeByItemId.set(item.id, range);
  }

  return [...items]
    .sort((a, b) => (rangeByItemId.get(b.id) ?? 0) - (rangeByItemId.get(a.id) ?? 0))
    .slice(0, limit);
}

// F-2-3-2: 지정 연도의 활성 UTILITY_BILL_ITEM별 월별 금액 추이 — 그 달에 값이 없는 항목은 null로
// 둔다(총액 추이와 달리 0으로 채우지 않음 — "이 항목이 이번 달 청구서에 아예 없었다"와 "0원
// 나왔다"는 다른 의미라 혼동하면 안 됨, 화면설계 §3-1 "값 없는 달은 '-'"). X축 범위는 총액 추이
// 차트와 동일(monthsToShow)로 맞춰 같은 화면에 나란히 놓았을 때 정렬되게 한다. 활성 항목이 많으면
// 최근 3개월 변화폭 상위 5개만 반환(topChangedItems 참고).
export async function getUtilityBillItemTrend(
  supabase: SupabaseServerClient,
  year: string
): Promise<UtilityBillItemTrendResult> {
  const { data: activeItems } = await supabase
    .from("utility_bill_item")
    .select("id, name")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  const items = activeItems ?? [];

  const monthCount = monthsToShow(year);
  if (monthCount === 0 || items.length === 0) {
    return { items, points: [], totalActiveItemCount: items.length };
  }

  const { data: records } = await supabase
    .from("utility_bill_record")
    .select("period, item_values:utility_bill_item_value(item_id, amount)")
    .gte("period", `${year}-01`)
    .lte("period", `${year}-${String(monthCount).padStart(2, "0")}`)
    .order("period", { ascending: true });

  const amountsByPeriod = new Map<string, Map<string, number>>();
  for (const record of records ?? []) {
    const byItem = new Map<string, number>();
    for (const value of record.item_values) {
      byItem.set(value.item_id, value.amount);
    }
    amountsByPeriod.set(record.period, byItem);
  }

  const points: UtilityBillItemTrendPoint[] = Array.from({ length: monthCount }, (_, i) => {
    const period = `${year}-${String(i + 1).padStart(2, "0")}`;
    const byItem = amountsByPeriod.get(period);
    const values: Record<string, number | null> = {};
    for (const item of items) {
      values[item.id] = byItem?.get(item.id) ?? null;
    }
    return { period, values };
  });

  const topItems = topChangedItems(items, points, TOP_CHANGED_ITEM_LIMIT);

  return { items: topItems, points, totalActiveItemCount: items.length };
}

function currentAndPreviousPeriod(): { current: string; previous: string } {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previous = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  return { current, previous };
}

export interface UtilityBillChangeRate {
  currentPeriod: string;
  previousPeriod: string;
  currentTotal: number | null;
  previousTotal: number | null;
  changeRate: number | null;
}

// F-2-3-3: 이번 달 대비 지난달 총액 증감률 — getDashboardSummary(F-1-8-1)와 동일 컨벤션(이번
// 달/지난달 중 하나라도 미등록이면 changeRate는 null, 지난달이 0원이면 나눗셈이 무의미해 역시
// null). 연도 선택(?year=)과 무관하게 항상 실제 오늘 기준 최신 상태를 보여준다 — 아래 항목별
// 추이/총액 추이처럼 과거 연도를 탐색하는 위젯이 아니라 "현재 스냅샷" 위젯이라 연동하지 않는다.
export async function getUtilityBillChangeRate(
  supabase: SupabaseServerClient
): Promise<UtilityBillChangeRate> {
  const { current, previous } = currentAndPreviousPeriod();

  const { data } = await supabase
    .from("utility_bill_record")
    .select("period, transaction:transaction_id!inner(amount)")
    .in("period", [current, previous]);

  const byPeriod = new Map((data ?? []).map((row) => [row.period, row.transaction.amount]));
  const currentTotal = byPeriod.get(current) ?? null;
  const previousTotal = byPeriod.get(previous) ?? null;
  const changeRate =
    currentTotal != null && previousTotal != null && previousTotal > 0
      ? (currentTotal - previousTotal) / previousTotal
      : null;

  return {
    currentPeriod: current,
    previousPeriod: previous,
    currentTotal,
    previousTotal,
    changeRate,
  };
}

export interface UtilityBillItemShare {
  itemId: string;
  itemName: string;
  amount: number;
}

// F-2-3-3: 이번 달 청구서의 항목별 비중 도넛용 데이터(화면설계 §3-1 "최근 달 기준"). 그 달에
// 실제로 청구된 항목만 대상 — 이후 비활성화된 항목이라도 그 달 실제 명세서 구성을 그대로
// 보여줘야 하므로 UTILITY_BILL_ITEM.is_active로 거르지 않는다(항목별 추이 위젯과 다른 점).
export async function getUtilityBillLatestItemBreakdown(
  supabase: SupabaseServerClient
): Promise<UtilityBillItemShare[]> {
  const { current } = currentAndPreviousPeriod();

  const { data: record } = await supabase
    .from("utility_bill_record")
    .select("item_values:utility_bill_item_value(item_id, amount, item:item_id(name))")
    .eq("period", current)
    .maybeSingle();

  if (!record) return [];

  return record.item_values
    .map((value) => ({
      itemId: value.item_id,
      itemName: value.item.name,
      amount: value.amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}
