// [F-2-4-4] 명세서 이력 확인 화면 전용 쿼리 — utility-bill-stats-queries.ts와 동일 컨벤션
// (supabase 클라이언트를 받는 순수 함수, RLS로 본인 데이터만 조회됨).
import type { createSupabaseServerClient } from "@account-books/supabase-client";
import { toYearMonth } from "@account-books/utils";
import type { UtilityBillExtraction, UtilityBillItemCandidate } from "./utility-bill-parse";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface UtilityBillHistoryPanel {
  period: string;
  source: string;
  total: number;
  // source='MANUAL'(F-2-4-3 훅으로 생성)은 OCR 추출 자체가 없어 raw_payload가 비어있다 —
  // 이 경우 total만 있고 items는 빈 배열.
  items: UtilityBillItemCandidate[];
  // [2026-07-19 PM 요청] 이 달(occurred_at 기준)과 원래 청구월(OCR 추출, period)이 다르면
  // 그 청구월을 보조 표시용으로 담는다(예: "2026-04 (3월)") — 같으면 null.
  billedPeriod: string | null;
}

// 요청한 달들(prev/center/next, occurred_at 기준) 중 실제로 등록된 것만 반환 — 없는 달은
// 호출부에서 "등록된 데이터가 없습니다"로 처리(맵에 키 자체가 없음). 같은 달에 레코드가 여러
// 개 몰리면(드문 경우, 청구월과 지출일을 다르게 등록해 겹친 경우) 합산해 하나로 보여준다.
export async function getUtilityBillHistoryPanels(
  supabase: SupabaseServerClient,
  periods: string[]
): Promise<Map<string, UtilityBillHistoryPanel>> {
  const { data } = await supabase
    .from("utility_bill_record")
    .select("period, source, transaction:transaction_id!inner(amount, raw_payload, occurred_at)");

  const rowsByMonth = new Map<
    string,
    { period: string; source: string; amount: number; items: UtilityBillItemCandidate[] }[]
  >();
  for (const row of data ?? []) {
    const month = toYearMonth(row.transaction.occurred_at);
    if (!periods.includes(month)) continue;
    const extraction = row.transaction.raw_payload as unknown as UtilityBillExtraction | null;
    const list = rowsByMonth.get(month) ?? [];
    list.push({
      period: row.period,
      source: row.source,
      amount: row.transaction.amount,
      items: extraction?.items ?? [],
    });
    rowsByMonth.set(month, list);
  }

  const panels = new Map<string, UtilityBillHistoryPanel>();
  for (const [month, rows] of rowsByMonth) {
    const billed = rows.find((r) => r.period !== month);
    // 같은 달에 UPLOAD 명세서와 무관한 MANUAL 등록(예: 다른 지출처의 관리비/공과금 수동입력)이
    // 함께 걸리면, 화면(UtilityBillItemBreakdown)엔 UPLOAD의 items만 표시되는데 total은 모든
    // 행의 amount를 더해 MANUAL분까지 섞여 "표시된 항목 합"과 "합계"가 어긋났다(운영 확인,
    // 2026-09-27). UPLOAD가 있는 달은 items 합으로 total을 맞추고(표시 내용과 항상 일치),
    // MANUAL만 있는 달(항목별 내역 자체가 없음)만 기존대로 amount 합산을 유지한다.
    const uploadRows = rows.filter((r) => r.source === "UPLOAD");
    const isUpload = uploadRows.length > 0;
    const items = uploadRows.flatMap((r) => r.items);
    panels.set(month, {
      period: month,
      source: isUpload ? "UPLOAD" : "MANUAL",
      total: isUpload
        ? items.reduce((sum, i) => sum + i.amount, 0)
        : rows.reduce((sum, r) => sum + r.amount, 0),
      items,
      billedPeriod: billed ? billed.period : null,
    });
  }
  return panels;
}

// 화살표 비활성화 경계("이전")에 쓰는, 그 계정에 등록된 가장 이른 달(occurred_at 기준) — 등록
// 이력이 아예 없으면 null(이 경우 호출부에서 이전/다음 둘 다 비활성화).
export async function getEarliestUtilityBillPeriod(
  supabase: SupabaseServerClient
): Promise<string | null> {
  const { data } = await supabase
    .from("utility_bill_record")
    .select("transaction:transaction_id!inner(occurred_at)");

  if (!data || data.length === 0) return null;

  const earliest = data.reduce((min, row) =>
    row.transaction.occurred_at < min.transaction.occurred_at ? row : min
  );
  return toYearMonth(earliest.transaction.occurred_at);
}
