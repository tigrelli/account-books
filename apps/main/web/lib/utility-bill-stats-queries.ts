// [F-2-3-x] 명세서 통계 화면(/utility-bills/stats) 전용 집계 쿼리 — dashboard-queries.ts와
// 동일 컨벤션(supabase 클라이언트를 받는 순수 함수, RLS로 본인 데이터만 조회됨).
import type { createSupabaseServerClient } from "@account-books/supabase-client";
import { toYearMonth } from "@account-books/utils";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// [2026-07-19 PM 요청] 통계/이력의 월별 분류 기준을 UTILITY_BILL_RECORD.period(OCR 추출 청구월)
// 대신 TRANSACTION.occurred_at(사용자가 확정한 지출일)으로 바꾼다 — 청구월과 다른 달을 지출일로
// 등록하면(예: 3월분 명세서를 4월 26일 지출로 등록) 통계가 지출일 기준(4월)으로 보여야 실제
// 가계부 흐름과 맞다. 단, 재업로드 중복 차단 판정(checkPeriodConflictAction)은 "같은 청구월
// 명세서를 두 번 올렸는지"가 핵심이라 여전히 period(OCR 청구월) 기준을 그대로 쓴다 — 여기서
// 바꾸는 건 통계/이력의 "어느 달에 표시할지"뿐이다. period가 occurred_at의 달과 다르면
// billedPeriod로 함께 내려줘 화면에서 "(3월)"처럼 원래 청구월을 보조 표시할 수 있게 한다.
interface RawRecordRow {
  period: string;
  source: string;
  transaction: { amount: number; occurred_at: string };
}

// 같은 지출월(occurred_at 기준)에 레코드가 여러 개 몰릴 수 있음(예: 3월분을 4월 지출로 등록한
// 것과 원래 4월분 명세서가 우연히 겹치는 경우) — 드문 경우지만 조용히 하나를 덮어쓰지 않도록
// 항상 배열로 묶어 합산한다.
function groupByOccurredMonth(rows: RawRecordRow[]): Map<string, RawRecordRow[]> {
  const map = new Map<string, RawRecordRow[]>();
  for (const row of rows) {
    const key = toYearMonth(row.transaction.occurred_at);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

// 그룹 내 레코드들의 period가 표시 월(occurred_at 기준)과 다르면 그 청구월을 보조 표시용으로
// 반환 — 여러 건이 섞여 있으면(드문 경우) 첫 번째 것만 대표로 보여준다.
function billedPeriodFor(rows: RawRecordRow[], displayPeriod: string): string | null {
  const differing = rows.find((r) => r.period !== displayPeriod);
  return differing ? differing.period : null;
}

export interface UtilityBillTotalTrendPoint {
  period: string;
  total: number;
  isManual: boolean;
  billedPeriod: string | null;
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
    .select("period, source, transaction:transaction_id!inner(amount, occurred_at)");

  const byMonth = groupByOccurredMonth(data ?? []);

  return Array.from({ length: monthCount }, (_, i) => {
    const period = `${year}-${String(i + 1).padStart(2, "0")}`;
    const rows = byMonth.get(period) ?? [];
    const total = rows.reduce((sum, r) => sum + r.transaction.amount, 0);
    return {
      period,
      total,
      isManual: rows.some((r) => r.source === "MANUAL"),
      billedPeriod: billedPeriodFor(rows, period),
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
// 최근 3개월 변화폭 상위 5개만 반환(topChangedItems 참고). 월 분류는 총액 추이와 동일하게
// occurred_at(지출일) 기준.
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
    .select(
      "item_values:utility_bill_item_value(item_id, amount), transaction:transaction_id!inner(occurred_at)"
    );

  const amountsByPeriod = new Map<string, Map<string, number>>();
  for (const record of records ?? []) {
    const period = toYearMonth(record.transaction.occurred_at);
    const byItem = amountsByPeriod.get(period) ?? new Map<string, number>();
    for (const value of record.item_values) {
      byItem.set(value.item_id, (byItem.get(value.item_id) ?? 0) + value.amount);
    }
    amountsByPeriod.set(period, byItem);
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
  const current = toYearMonth(now);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previous = toYearMonth(prev);
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
// "이번 달"/"지난달"도 occurred_at(지출일) 기준.
export async function getUtilityBillChangeRate(
  supabase: SupabaseServerClient
): Promise<UtilityBillChangeRate> {
  const { current, previous } = currentAndPreviousPeriod();

  const { data } = await supabase
    .from("utility_bill_record")
    .select("transaction:transaction_id!inner(amount, occurred_at)");

  const byMonth = groupByOccurredMonth(
    (data ?? []).map((row) => ({ period: "", source: "", transaction: row.transaction }))
  );
  const sumFor = (period: string): number | null => {
    const rows = byMonth.get(period);
    if (!rows || rows.length === 0) return null;
    return rows.reduce((sum, r) => sum + r.transaction.amount, 0);
  };

  const currentTotal = sumFor(current);
  const previousTotal = sumFor(previous);
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
// "이번 달"은 occurred_at(지출일) 기준.
export async function getUtilityBillLatestItemBreakdown(
  supabase: SupabaseServerClient
): Promise<UtilityBillItemShare[]> {
  const { current } = currentAndPreviousPeriod();

  const { data } = await supabase
    .from("utility_bill_record")
    .select(
      "item_values:utility_bill_item_value(item_id, amount, item:item_id(name)), transaction:transaction_id!inner(occurred_at)"
    );

  const matching = (data ?? []).filter(
    (row) => toYearMonth(row.transaction.occurred_at) === current
  );
  if (matching.length === 0) return [];

  const byItem = new Map<string, UtilityBillItemShare>();
  for (const row of matching) {
    for (const value of row.item_values) {
      const existing = byItem.get(value.item_id);
      if (existing) {
        existing.amount += value.amount;
      } else {
        byItem.set(value.item_id, {
          itemId: value.item_id,
          itemName: value.item.name,
          amount: value.amount,
        });
      }
    }
  }

  return Array.from(byItem.values()).sort((a, b) => b.amount - a.amount);
}

export interface UtilityBillTotalMismatch {
  itemsTotal: number;
  officialTotal: number;
}

// F-2-4-2: 이번 달 지정 항목 합계(UTILITY_BILL_ITEM_VALUE)와 실제 등록 금액(TRANSACTION.amount)이
// 다른지 확인(화면설계 §3-3) — 항목 선정 화면(F-2-2-1/2)에서 항목을 해제해도 TRANSACTION.amount는
// OCR 추출 총액 그대로라 의도적으로 불일치가 생길 수 있고, 지출 수정 화면에서 금액을 직접
// 고쳐도 발생한다. 일치하면 null(알림 아이콘 숨김) — getUtilityBillLatestItemBreakdown과 동일하게
// "이번 달"(occurred_at 기준) 기준만 본다(PM 확인, 2026-07-19).
export async function getUtilityBillTotalMismatch(
  supabase: SupabaseServerClient
): Promise<UtilityBillTotalMismatch | null> {
  const { current } = currentAndPreviousPeriod();

  const { data } = await supabase
    .from("utility_bill_record")
    .select(
      "item_values:utility_bill_item_value(amount), transaction:transaction_id!inner(amount, occurred_at)"
    );

  const matching = (data ?? []).filter(
    (row) => toYearMonth(row.transaction.occurred_at) === current
  );
  if (matching.length === 0) return null;

  const itemsTotal = matching.reduce(
    (sum, row) => sum + row.item_values.reduce((s, v) => s + v.amount, 0),
    0
  );
  const officialTotal = matching.reduce((sum, row) => sum + row.transaction.amount, 0);
  if (itemsTotal === officialTotal) return null;

  return { itemsTotal, officialTotal };
}
