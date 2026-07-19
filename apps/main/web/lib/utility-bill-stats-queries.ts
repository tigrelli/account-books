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
