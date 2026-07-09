// [S-1-15] 대시보드용 집계 쿼리 — F-1-8-1(요약카드)/F-1-8-2(월별추이)/F-1-8-3(카테고리별) 세 화면이
// 공통으로 재사용한다. Phase 1은 MV 없이 TRANSACTION을 직접 fetch 후 JS에서 집계(F-1-7-2와 동일 컨벤션).
import type { createSupabaseServerClient } from "@account-books/supabase-client";
import { toYearMonth } from "@account-books/utils";
import { getItemTop10 } from "./stats-cache";
import { resolveCanonicalItemId } from "./item-merge";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// F-3-1-3 드릴다운 액션(app/(app)/actions.ts)도 동일한 기간 계산이 필요해 export.
export function periodToRange(period: string): { start: Date; end: Date } {
  const start = new Date(`${period}-01`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return { start, end };
}

function previousPeriod(period: string): string {
  const { start } = periodToRange(period);
  return toYearMonth(new Date(start.getFullYear(), start.getMonth() - 1, 1));
}

function sumAmounts(rows: { amount: number }[] | null): number {
  return (rows ?? []).reduce((sum, row) => sum + row.amount, 0);
}

export interface DashboardSummary {
  period: string;
  totalThisMonth: number;
  totalLastMonth: number;
  changeRate: number | null;
  budgetLimit: number | null;
  budgetConsumptionRate: number | null;
}

// F-1-8-1: 이번달 총지출, 전월 대비, 예산 소진율 요약카드
export async function getDashboardSummary(
  supabase: SupabaseServerClient,
  period: string
): Promise<DashboardSummary> {
  const thisMonth = periodToRange(period);
  const lastMonth = periodToRange(previousPeriod(period));

  const [{ data: thisMonthTx }, { data: lastMonthTx }, { data: budgetTotal }] = await Promise.all([
    supabase
      .from("transaction")
      .select("amount")
      .gte("occurred_at", thisMonth.start.toISOString())
      .lt("occurred_at", thisMonth.end.toISOString()),
    supabase
      .from("transaction")
      .select("amount")
      .gte("occurred_at", lastMonth.start.toISOString())
      .lt("occurred_at", lastMonth.end.toISOString()),
    supabase.from("budget_total").select("limit_amount").eq("period", period).maybeSingle(),
  ]);

  const totalThisMonth = sumAmounts(thisMonthTx);
  const totalLastMonth = sumAmounts(lastMonthTx);
  const budgetLimit = budgetTotal?.limit_amount ?? null;

  return {
    period,
    totalThisMonth,
    totalLastMonth,
    changeRate: totalLastMonth > 0 ? (totalThisMonth - totalLastMonth) / totalLastMonth : null,
    budgetLimit,
    budgetConsumptionRate: budgetLimit && budgetLimit > 0 ? totalThisMonth / budgetLimit : null,
  };
}

export interface MonthlyTrendPoint {
  period: string;
  total: number;
}

// F-1-8-2: 최근 N개월(latestPeriod 포함) 지출 추이 — 데이터 없는 달도 0으로 채워서 반환
export async function getMonthlyTrend(
  supabase: SupabaseServerClient,
  latestPeriod: string,
  monthsBack: number
): Promise<MonthlyTrendPoint[]> {
  const latestStart = periodToRange(latestPeriod).start;
  const rangeStart = new Date(
    latestStart.getFullYear(),
    latestStart.getMonth() - (monthsBack - 1),
    1
  );
  const rangeEnd = periodToRange(latestPeriod).end;

  const { data } = await supabase
    .from("transaction")
    .select("amount, occurred_at")
    .gte("occurred_at", rangeStart.toISOString())
    .lt("occurred_at", rangeEnd.toISOString());

  const totalsByPeriod = new Map<string, number>();
  for (const row of data ?? []) {
    const key = toYearMonth(row.occurred_at);
    totalsByPeriod.set(key, (totalsByPeriod.get(key) ?? 0) + row.amount);
  }

  const points: MonthlyTrendPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const key = toYearMonth(new Date(latestStart.getFullYear(), latestStart.getMonth() - i, 1));
    points.push({ period: key, total: totalsByPeriod.get(key) ?? 0 });
  }
  return points;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  icon: string | null;
  total: number;
}

// F-1-8-3: 지정 기간의 카테고리별(도넛/트리맵용) 집계 — 지출 없는 카테고리는 제외, 금액 내림차순
export async function getCategoryBreakdown(
  supabase: SupabaseServerClient,
  period: string
): Promise<CategoryBreakdownItem[]> {
  const { start, end } = periodToRange(period);

  const [{ data: categories }, { data: transactions }] = await Promise.all([
    supabase.from("category").select("id, name, icon").eq("is_active", true),
    supabase
      .from("transaction")
      .select("category_id, amount")
      .gte("occurred_at", start.toISOString())
      .lt("occurred_at", end.toISOString()),
  ]);

  const totalsByCategory = new Map<string, number>();
  for (const tx of transactions ?? []) {
    totalsByCategory.set(tx.category_id, (totalsByCategory.get(tx.category_id) ?? 0) + tx.amount);
  }

  return (categories ?? [])
    .map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      icon: category.icon,
      total: totalsByCategory.get(category.id) ?? 0,
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
}

export interface PaymentMethodBreakdownItem {
  paymentMethodId: string;
  displayName: string;
  type: string;
  cardKind: string | null;
  subtype: string | null;
  total: number;
}

export interface PaymentMethodBreakdownResult {
  items: PaymentMethodBreakdownItem[];
  cashTotal: number;
  cardTotal: number;
}

// F-3-1-1: 지정 기간의 지출분류별(현금/카드 대분류 + 카드는 카드사명별) 집계 —
// 지출 없는 지출분류는 제외, 현금이 먼저 오고 카드는 금액 내림차순(대분류 경계가 항상 붙어있도록 정렬).
export async function getPaymentMethodBreakdown(
  supabase: SupabaseServerClient,
  period: string
): Promise<PaymentMethodBreakdownResult> {
  const { start, end } = periodToRange(period);

  const [{ data: paymentMethods }, { data: transactions }] = await Promise.all([
    supabase
      .from("payment_method")
      .select("id, display_name, type, card_kind, subtype")
      .eq("is_active", true),
    supabase
      .from("transaction")
      .select("payment_method_id, amount")
      .gte("occurred_at", start.toISOString())
      .lt("occurred_at", end.toISOString()),
  ]);

  const totalsByPaymentMethod = new Map<string, number>();
  for (const tx of transactions ?? []) {
    totalsByPaymentMethod.set(
      tx.payment_method_id,
      (totalsByPaymentMethod.get(tx.payment_method_id) ?? 0) + tx.amount
    );
  }

  const items = (paymentMethods ?? [])
    .map((pm) => ({
      paymentMethodId: pm.id,
      displayName: pm.display_name,
      type: pm.type,
      cardKind: pm.card_kind,
      subtype: pm.subtype,
      total: totalsByPaymentMethod.get(pm.id) ?? 0,
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "CASH" ? -1 : 1;
      return b.total - a.total;
    });

  const cashTotal = items
    .filter((item) => item.type === "CASH")
    .reduce((sum, item) => sum + item.total, 0);
  const cardTotal = items
    .filter((item) => item.type === "CARD")
    .reduce((sum, item) => sum + item.total, 0);

  return { items, cashTotal, cardTotal };
}

export interface VendorTopNItem {
  vendorId: string;
  vendorName: string;
  total: number;
}

const VENDOR_TOP_N_LIMIT = 10;

// F-3-1-2: 지정 기간의 지출처별 Top N — tx_stats(S-3-1)는 이미 (period, vendor_id) 등으로
// 사전 집계돼 있어, 여기서는 RPC 결과를 vendor_id 기준으로 한 번 더 합산(같은 지출처라도 카테고리/
// 지출분류 조합별로 여러 행에 나뉘어 있음)하고 이름을 붙이기만 하면 된다 — raw transaction을
// 다시 스캔하지 않음(F-1-8-1~3/F-3-1-1은 S-3-1 이전에 만들어져 아직 직접 쿼리 방식으로 남아있음).
export async function getVendorTopN(
  supabase: SupabaseServerClient,
  period: string
): Promise<VendorTopNItem[]> {
  const [{ data: stats }, { data: vendors }] = await Promise.all([
    supabase.rpc("get_tx_stats", { p_period: period }),
    supabase.from("vendor").select("id, name"),
  ]);

  const nameById = new Map((vendors ?? []).map((v) => [v.id, v.name]));
  const totalsByVendor = new Map<string, number>();
  for (const row of stats ?? []) {
    if (!row.vendor_id) continue; // 지출처는 필수 입력이라 실무상 발생하지 않지만 타입상 nullable
    totalsByVendor.set(
      row.vendor_id,
      (totalsByVendor.get(row.vendor_id) ?? 0) + (row.total_amount ?? 0)
    );
  }

  return Array.from(totalsByVendor.entries())
    .map(([vendorId, total]) => ({
      vendorId,
      vendorName: nameById.get(vendorId) ?? "알 수 없음",
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, VENDOR_TOP_N_LIMIT);
}

export interface ItemTop10DisplayEntry {
  itemId: string;
  itemName: string;
  totalAmount: number;
  transactionCount: number;
}

// F-3-1-3: item_stats(S-3-2) 기반 상세항목 Top10 — getItemTop10(S-3-6)의 Redis 캐시를 그대로
// 사용하고, 화면에 필요한 품목명만 붙인다. 병합(F-1-6-3) 처리 노트(S-3-2 메모 참고): 캐시된
// item_id는 mergeItemAction이 병합 시점에 이미 대표 품목으로 재배정해둔 값이 보통이지만, 재배정이
// 누락된 과거 데이터가 섞여 있는 엣지 케이스를 대비해 resolveCanonicalItemId로 한 번 더 정규화하고
// (같은 대표 품목으로 모이면 합산) 다시 정렬한다.
export async function getItemTop10Display(
  supabase: SupabaseServerClient,
  userId: string,
  period: string,
  monthsBack: number = 1
): Promise<ItemTop10DisplayEntry[]> {
  const [top10, { data: items }] = await Promise.all([
    getItemTop10(supabase, userId, period, monthsBack),
    supabase.from("item").select("id, name, aliases, merged_into_item_id").eq("user_id", userId),
  ]);

  const mergeableItems = items ?? [];
  const nameById = new Map(mergeableItems.map((i) => [i.id, i.name]));

  const merged = new Map<string, { totalAmount: number; transactionCount: number }>();
  for (const entry of top10) {
    const canonicalId = resolveCanonicalItemId(entry.itemId, mergeableItems);
    const existing = merged.get(canonicalId);
    merged.set(canonicalId, {
      totalAmount: (existing?.totalAmount ?? 0) + entry.totalAmount,
      transactionCount: (existing?.transactionCount ?? 0) + entry.transactionCount,
    });
  }

  return Array.from(merged.entries())
    .map(([itemId, agg]) => ({
      itemId,
      itemName: nameById.get(itemId) ?? "알 수 없음",
      totalAmount: agg.totalAmount,
      transactionCount: agg.transactionCount,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export interface UnitPriceOption {
  itemId: string;
  unitId: string;
  itemName: string;
  unitName: string;
  totalQuantity: number;
}

// F-3-1-4: 단가 분석 대상(품목×단위 조합) 선택지 — 최근 monthsBack개월 동안 구조화된
// 수량(quantity_value+unit_id)으로 기록된 조합만 나열한다(item_unit_stats는 애초에 그 조건만
// 집계, S-3-3). get_item_unit_stats(NULL)로 전체 기간을 한 번에 가져와 최근 구간만 합산 —
// 트렌드 조회(getUnitPriceTrend)와 같은 원본 데이터를 재사용해 별도 range 쿼리를 만들지 않는다.
export async function getUnitPriceOptions(
  supabase: SupabaseServerClient,
  latestPeriod: string,
  monthsBack: number
): Promise<UnitPriceOption[]> {
  const periods = recentPeriods(latestPeriod, monthsBack);
  const periodSet = new Set(periods);

  const [{ data: stats }, { data: items }, { data: units }] = await Promise.all([
    supabase.rpc("get_item_unit_stats", {}),
    supabase.from("item").select("id, name"),
    supabase.from("unit").select("id, name"),
  ]);

  const itemNameById = new Map((items ?? []).map((i) => [i.id, i.name]));
  const unitNameById = new Map((units ?? []).map((u) => [u.id, u.name]));

  const totals = new Map<string, { itemId: string; unitId: string; totalQuantity: number }>();
  for (const row of stats ?? []) {
    if (!row.item_id || !row.unit_id || !row.period || !periodSet.has(row.period)) continue;
    const key = `${row.item_id}:${row.unit_id}`;
    const existing = totals.get(key);
    totals.set(key, {
      itemId: row.item_id,
      unitId: row.unit_id,
      totalQuantity: (existing?.totalQuantity ?? 0) + (row.total_quantity ?? 0),
    });
  }

  return Array.from(totals.values())
    .map((entry) => ({
      ...entry,
      itemName: itemNameById.get(entry.itemId) ?? "알 수 없음",
      unitName: unitNameById.get(entry.unitId) ?? "",
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity);
}

export interface UnitPriceTrendPoint {
  period: string;
  avgUnitPrice: number | null;
  totalQuantity: number;
}

function recentPeriods(latestPeriod: string, monthsBack: number): string[] {
  const latestStart = periodToRange(latestPeriod).start;
  const periods: string[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    periods.push(toYearMonth(new Date(latestStart.getFullYear(), latestStart.getMonth() - i, 1)));
  }
  return periods;
}

// F-3-1-4: 특정 품목×단위 조합의 최근 monthsBack개월 평균 단가 추이(item_unit_stats, S-3-3
// 기반) — "양파(kg) 평균 단가가 이번 달 얼마나 올랐는지" 같은 화면. 데이터 없는 달은 null로
// 채워 그래프에서 끊어 보이게 한다(0원으로 채우면 "그 달은 공짜로 샀다"처럼 오독될 수 있음 —
// getMonthlyTrend의 지출 합계와 달리 평균 단가는 0이 유효한 값이 아니라서 구분).
export async function getUnitPriceTrend(
  supabase: SupabaseServerClient,
  itemId: string,
  unitId: string,
  latestPeriod: string,
  monthsBack: number
): Promise<UnitPriceTrendPoint[]> {
  const { data: stats } = await supabase.rpc("get_item_unit_stats", {});

  const byPeriod = new Map(
    (stats ?? [])
      .filter((row) => row.item_id === itemId && row.unit_id === unitId && row.period)
      .map((row) => [row.period as string, row])
  );

  return recentPeriods(latestPeriod, monthsBack).map((period) => {
    const row = byPeriod.get(period);
    return {
      period,
      avgUnitPrice: row?.avg_unit_price ?? null,
      totalQuantity: row?.total_quantity ?? 0,
    };
  });
}
