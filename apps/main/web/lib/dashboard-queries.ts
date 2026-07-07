// [S-1-15] 대시보드용 집계 쿼리 — F-1-8-1(요약카드)/F-1-8-2(월별추이)/F-1-8-3(카테고리별) 세 화면이
// 공통으로 재사용한다. Phase 1은 MV 없이 TRANSACTION을 직접 fetch 후 JS에서 집계(F-1-7-2와 동일 컨벤션).
import type { createSupabaseServerClient } from "@account-books/supabase-client";
import { toYearMonth } from "@account-books/utils";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function periodToRange(period: string): { start: Date; end: Date } {
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
