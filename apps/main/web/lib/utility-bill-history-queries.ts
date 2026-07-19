// [F-2-4-4] 명세서 이력 확인 화면 전용 쿼리 — utility-bill-stats-queries.ts와 동일 컨벤션
// (supabase 클라이언트를 받는 순수 함수, RLS로 본인 데이터만 조회됨).
import type { createSupabaseServerClient } from "@account-books/supabase-client";
import type { UtilityBillExtraction, UtilityBillItemCandidate } from "./utility-bill-parse";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface UtilityBillHistoryPanel {
  period: string;
  source: string;
  total: number;
  // source='MANUAL'(F-2-4-3 훅으로 생성)은 OCR 추출 자체가 없어 raw_payload가 비어있다 —
  // 이 경우 total만 있고 items는 빈 배열.
  items: UtilityBillItemCandidate[];
}

// 요청한 청구월들(prev/center/next) 중 실제로 등록된 것만 반환 — 없는 달은 호출부에서
// "등록된 데이터가 없습니다"로 처리(맵에 키 자체가 없음).
export async function getUtilityBillHistoryPanels(
  supabase: SupabaseServerClient,
  periods: string[]
): Promise<Map<string, UtilityBillHistoryPanel>> {
  const { data } = await supabase
    .from("utility_bill_record")
    .select("period, source, transaction:transaction_id!inner(amount, raw_payload)")
    .in("period", periods);

  const panels = new Map<string, UtilityBillHistoryPanel>();
  for (const row of data ?? []) {
    const extraction = row.transaction.raw_payload as unknown as UtilityBillExtraction | null;
    panels.set(row.period, {
      period: row.period,
      source: row.source,
      total: row.transaction.amount,
      items: extraction?.items ?? [],
    });
  }
  return panels;
}

// 화살표 비활성화 경계("이전")에 쓰는, 그 계정에 등록된 가장 이른 청구월 — 등록 이력이
// 아예 없으면 null(이 경우 호출부에서 이전/다음 둘 다 비활성화).
export async function getEarliestUtilityBillPeriod(
  supabase: SupabaseServerClient
): Promise<string | null> {
  const { data } = await supabase
    .from("utility_bill_record")
    .select("period")
    .order("period", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.period ?? null;
}
