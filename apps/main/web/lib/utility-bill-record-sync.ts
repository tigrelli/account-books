import type { createSupabaseServerClient } from "@account-books/supabase-client";
import { toYearMonth } from "@account-books/utils";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const UTILITY_CATEGORY_NAME = "관리비/공과금";

// [F-2-4-6] 업로드 지출처 기본값 — 직전 업로드가 없을 때(최초 업로드) 쓴다(데이터구조설계 §2-4).
export const DEFAULT_UTILITY_VENDOR_NAME = "관리사무소";

// PostgreSQL unique_violation — UNIQUE(user_id, period, vendor_id) 충돌을 다른 실패와 구분해
// "왜 막혔는지"를 사용자에게 보여주기 위해 사용(예전엔 일반 저장 실패 문구로 원인이 가려졌다).
export const UNIQUE_VIOLATION = "23505";

export type UtilityBillRecordSyncResult = { ok: true } | { ok: false; message: string };

export function duplicateUtilityBillMessage(vendorName: string): string {
  return `이 달에 '${vendorName}' 관리비가 이미 등록되어 있습니다`;
}

interface SyncInput {
  userId: string;
  transactionId: string;
  categoryId: string;
  vendorId: string;
  vendorName: string;
  occurredAt: string;
}

async function isUtilityCategory(
  supabase: SupabaseServerClient,
  categoryId: string
): Promise<boolean> {
  const { data: category } = await supabase
    .from("category")
    .select("name")
    .eq("id", categoryId)
    .maybeSingle();
  return category?.name === UTILITY_CATEGORY_NAME;
}

function toResult(
  error: { code?: string } | null,
  vendorName: string,
  fallbackMessage: string
): UtilityBillRecordSyncResult {
  if (!error) return { ok: true };
  console.error("[utility-bill-record-sync] 실패:", error);
  return {
    ok: false,
    message:
      error.code === UNIQUE_VIOLATION ? duplicateUtilityBillMessage(vendorName) : fallbackMessage,
  };
}

// [F-2-4-3 → F-2-4-5] 카테고리="관리비/공과금"으로 지출을 직접 입력하면 UTILITY_BILL_RECORD
// (source='MANUAL')도 함께 생성 — 업로드 화면의 "이미 수동 등록 존재 시 업로드 차단"(케이스 A)이
// 이 레코드로 판정된다(화면설계 §4-1). 같은 달·같은 지출처면 유니크 위반으로 실패한다.
export async function createManualUtilityBillRecordIfNeeded(
  supabase: SupabaseServerClient,
  input: SyncInput
): Promise<UtilityBillRecordSyncResult> {
  if (!(await isUtilityCategory(supabase, input.categoryId))) return { ok: true };

  const { error } = await supabase.from("utility_bill_record").insert({
    user_id: input.userId,
    period: toYearMonth(input.occurredAt),
    vendor_id: input.vendorId,
    source: "MANUAL",
    transaction_id: input.transactionId,
  });
  return toResult(error, input.vendorName, "관리비 등록에 실패했습니다");
}

// [F-2-4-5] 지출 수정 시 UTILITY_BILL_RECORD를 수정 내용에 맞춘다(화면설계 §4-2 표).
// - MANUAL: 카테고리가 관리비/공과금에서 빠지면 삭제(남겨두면 그 달·지출처를 계속 막는다),
//   들어오면 생성, 지출일의 달·지출처가 바뀌면 period·vendor_id 갱신.
// - UPLOAD: period는 명세서 청구월이라 지출일과 무관하게 유지하고 vendor_id만 맞춘다. 카테고리를
//   바꿔도 삭제하지 않는다 — 삭제하면 항목별 원본(UTILITY_BILL_ITEM_VALUE)이 연쇄 삭제된다.
// 트랜잭션 UPDATE보다 먼저 호출해, 충돌 시 지출이 바뀌지 않은 상태로 거절되게 한다.
export async function syncUtilityBillRecordOnUpdate(
  supabase: SupabaseServerClient,
  input: SyncInput
): Promise<UtilityBillRecordSyncResult> {
  const [{ data: record }, isUtility] = await Promise.all([
    supabase
      .from("utility_bill_record")
      .select("id, period, source, vendor_id")
      .eq("transaction_id", input.transactionId)
      .maybeSingle(),
    isUtilityCategory(supabase, input.categoryId),
  ]);

  if (!record) {
    return isUtility ? createManualUtilityBillRecordIfNeeded(supabase, input) : { ok: true };
  }

  if (record.source === "MANUAL" && !isUtility) {
    const { error } = await supabase.from("utility_bill_record").delete().eq("id", record.id);
    return toResult(error, input.vendorName, "관리비 등록 정리에 실패했습니다");
  }

  const updates: { period?: string; vendor_id?: string } = {};
  if (record.vendor_id !== input.vendorId) updates.vendor_id = input.vendorId;
  if (record.source === "MANUAL") {
    const newPeriod = toYearMonth(input.occurredAt);
    if (newPeriod !== record.period) updates.period = newPeriod;
  }
  if (Object.keys(updates).length === 0) return { ok: true };

  const { error } = await supabase.from("utility_bill_record").update(updates).eq("id", record.id);
  return toResult(error, input.vendorName, "관리비 등록 갱신에 실패했습니다");
}
