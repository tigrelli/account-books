"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@account-books/types";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { createUploadUrlSchema, type CreateUploadUrlInput } from "@/lib/utility-bill-schemas";
import { createOCRProvider } from "@/lib/ocr";
import {
  extractUtilityBill,
  ELECTRICITY_SEDAE_LABEL,
  WATER_SEDAE_LABEL,
  type UtilityBillExtraction,
} from "@/lib/utility-bill-parse";
import { calculateFormatMatchRate, isSameFormat } from "@/lib/utility-bill-format-match";
import type { ActiveUtilityBillItemInfo } from "@/lib/utility-bill-pending-storage";

// [S-2-5]에서 만든 비공개 버킷. 경로 규칙: {user_id}/{period}.{ext}.
// "use server" 파일을 클라이언트 컴포넌트가 import하면 Next.js가 모든 export를 서버
// 액션(비동기 함수)으로 취급해야 해서, 상수를 export하면 빌드가 깨진다(F-2-1-2에서
// UtilityBillUploadSection.tsx가 이 파일을 처음 import하며 발견) — 그래서 export하지
// 않고 이 파일 안에서만 쓴다. 클라이언트에서 필요한 값은 lib/utility-bill-upload.ts에
// 별도로 정의되어 있다.
const UTILITY_BILLS_BUCKET = "utility-bills";

export type CreateUploadUrlResult =
  | { status: "success"; path: string; token: string }
  | { status: "error"; message: string };

/**
 * 관리비 명세서 파일용 signed upload URL 발급.
 * 경로의 user_id는 클라이언트 입력이 아니라 서버에서 인증된 세션으로부터만 만든다 —
 * 다른 사용자 경로로 업로드 URL을 요청할 수 없도록 하기 위함(스토리지 RLS와 별개의 방어선).
 * 클라이언트는 이 함수가 반환한 path/token으로 Storage에 직접 업로드한다(Vercel 함수
 * 4.5MB 본문 제한 우회, docs/2차/관리비명세서_데이터구조설계.md §5).
 */
export async function createUploadUrlAction(
  input: CreateUploadUrlInput
): Promise<CreateUploadUrlResult> {
  const parsed = createUploadUrlSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "잘못된 요청입니다" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "로그인이 필요합니다" };

  const path = `${user.id}/${parsed.data.period}.${parsed.data.ext}`;

  const { data, error } = await supabase.storage
    .from(UTILITY_BILLS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { status: "error", message: "업로드 URL 발급에 실패했습니다" };
  }

  return { status: "success", path: data.path, token: data.token };
}

export type ExtractUtilityBillResult =
  | ({ status: "success" } & UtilityBillExtraction)
  | { status: "error"; message: string };

/**
 * 선택된 파일을 OCR로 읽어 사용량별 지침표 + 관리비 상세표 + 총액/청구월 후보를
 * 추출한다. 항목 선정 화면(F-2-2-1, 백로그 B-13)이 이 후보를 보여주고 최종 확인은
 * 사람이 한다 — 여기서는 후보만 만든다.
 *
 * [F-2-1-2 재설계, 2026-07-13 PM 확인] 원래 설계(화면설계 §1-2)는 "업로드 → 충돌
 * 확인 → OCR" 순서였으나, 청구월(period)을 OCR로만 알 수 있고 Storage 저장 경로
 * 자체가 {user_id}/{period}.{ext}라 "경로를 정하기 전에 OCR부터 해야 하는" 순환
 * 문제가 있었다. 그래서 파일을 Storage에 올리지 않고 바로 여기서 OCR을 돌리고,
 * 실제 Storage 업로드(createUploadUrlAction)는 청구월이 확정된 뒤(F-2-1-3 저장
 * 시점)로 미룬다.
 */
export async function extractUtilityBillAction(
  formData: FormData
): Promise<ExtractUtilityBillResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "로그인이 필요합니다" };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { status: "error", message: "잘못된 요청입니다" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const provider = createOCRProvider();
    const ocrResult = await provider.extractText(buffer);
    const extraction = extractUtilityBill(ocrResult);
    return { status: "success", ...extraction };
  } catch {
    return { status: "error", message: "OCR 처리에 실패했습니다" };
  }
}

export type ConflictCheckResult =
  | { status: "none" }
  | { status: "blocked" } // 케이스 A — 이미 수동 등록 존재, 업로드 차단
  | { status: "confirm_needed" }; // 케이스 B — 이미 업로드 존재, 재업로드 확인 필요

/**
 * OCR로 확정된 청구월(period) 기준으로 기존 등록 여부를 확인한다(화면설계 §1-2/1-3).
 */
export async function checkPeriodConflictAction(period: string): Promise<ConflictCheckResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "none" };

  const { data: existing } = await supabase
    .from("utility_bill_record")
    .select("source")
    .eq("period", period)
    .maybeSingle();

  if (!existing) return { status: "none" };
  return existing.source === "MANUAL" ? { status: "blocked" } : { status: "confirm_needed" };
}

export interface FormatMatchResult {
  isSameFormat: boolean;
  activeItems: ActiveUtilityBillItemInfo[];
}

/**
 * 화면설계 §1-2 3번 — 추출된 라벨과 사용자의 기존 지정 항목(활성 `UTILITY_BILL_ITEM.
 * source_labels`)을 비교해 매칭률(S-2-9)을 계산한다. 매칭률 ≥ 50%면 확인 화면(F-2-1-3)
 * 으로 바로 진행하고, 미만(지정 항목이 아예 없는 최초 업로드 포함)이면 항목 선정 화면
 * (F-2-2-1)으로 보낸다. `activeItems`는 항목 선정 화면에서 "이번 달에 없음" 구획을
 * 만드는 데도 재사용한다.
 */
export async function checkUtilityBillFormatMatchAction(
  extractedLabels: string[]
): Promise<FormatMatchResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isSameFormat: false, activeItems: [] };

  const { data } = await supabase
    .from("utility_bill_item")
    .select("name, source_labels")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const activeItems: ActiveUtilityBillItemInfo[] = (data ?? []).map((i) => ({
    name: i.name,
    sourceLabels: (i.source_labels as string[] | null) ?? [],
  }));

  const matchRate = calculateFormatMatchRate(
    extractedLabels,
    activeItems.map((i) => i.sourceLabels)
  );

  return { isSameFormat: isSameFormat(matchRate), activeItems };
}

const CATEGORY_NAME = "관리비/공과금";
const VENDOR_NAME = "관리사무소";

export type RecentPaymentMethodResult =
  | { found: true; paymentMethodId: string; displayName: string }
  | { found: false };

/**
 * 직전에 등록한 관리비 명세서의 결제수단을 조회한다(F-2-1-3, PM 결정) — 있으면 "직전
 * 결제수단으로 등록할까요?" 확인 팝업에, 없으면 결제수단 직접 선택 팝업으로 이어진다.
 * 설계서에 결제수단 선택 기준이 없어 새로 정한 규칙.
 */
export async function getRecentPaymentMethodAction(): Promise<RecentPaymentMethodResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { found: false };

  const { data: record } = await supabase
    .from("utility_bill_record")
    .select("transaction_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!record) return { found: false };

  const { data: tx } = await supabase
    .from("transaction")
    .select("payment_method_id")
    .eq("id", record.transaction_id)
    .maybeSingle();
  if (!tx) return { found: false };

  const { data: pm } = await supabase
    .from("payment_method")
    .select("display_name")
    .eq("id", tx.payment_method_id)
    .maybeSingle();
  if (!pm) return { found: false };

  return { found: true, paymentMethodId: tx.payment_method_id, displayName: pm.display_name };
}

export interface PaymentMethodOption {
  id: string;
  displayName: string;
}

/** 직전 등록 이력이 없을 때(최초) 결제수단 직접 선택 팝업에 쓸 목록. */
export async function getActivePaymentMethodsAction(): Promise<PaymentMethodOption[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("payment_method")
    .select("id, display_name")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return (data ?? []).map((p) => ({ id: p.id, displayName: p.display_name }));
}

export type SaveUtilityBillResult = { status: "success" } | { status: "error"; message: string };

/**
 * 확인된 관리비 명세서를 저장한다 — TRANSACTION(occurred_at=사용자 확정 날짜, 기본값
 * 청구월 말일) + UTILITY_BILL_RECORD(source='UPLOAD') + 항목별 UTILITY_BILL_ITEM_VALUE
 * 생성, 원본 파일을 그제서야 Storage에 업로드한다(F-2-1-2에서 미룬 단계).
 *
 * 항목 선정 화면(F-2-2-1, 백로그 B-13)이 아직 없어 추출된 항목을 사람이 고르는 절차
 * 없이 전부 자동으로 UTILITY_BILL_ITEM으로 등록(이름 기준 upsert)한다 — "재업로드 기준"
 * 진행 방침(2026-07-13 PM 결정)에 따른 임시 처리.
 */
export async function saveUtilityBillAction(formData: FormData): Promise<SaveUtilityBillResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "로그인이 필요합니다" };

  const extractionRaw = formData.get("extraction");
  const paymentMethodId = formData.get("paymentMethodId");
  const occurredAtDate = formData.get("occurredAt");
  const replaceExisting = formData.get("replaceExisting") === "true";
  const file = formData.get("file");

  if (
    typeof extractionRaw !== "string" ||
    typeof paymentMethodId !== "string" ||
    typeof occurredAtDate !== "string" ||
    !(file instanceof File)
  ) {
    return { status: "error", message: "잘못된 요청입니다" };
  }

  let extraction: UtilityBillExtraction;
  try {
    extraction = JSON.parse(extractionRaw) as UtilityBillExtraction;
  } catch {
    return { status: "error", message: "잘못된 요청입니다" };
  }
  if (!extraction.period || extraction.total == null) {
    return { status: "error", message: "잘못된 요청입니다" };
  }

  const { data: category } = await supabase
    .from("category")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", CATEGORY_NAME)
    .eq("is_active", true)
    .maybeSingle();
  if (!category) {
    return { status: "error", message: "관리비/공과금 카테고리를 찾을 수 없습니다" };
  }

  let vendorId: string;
  const { data: existingVendor } = await supabase
    .from("vendor")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", VENDOR_NAME)
    .maybeSingle();
  if (existingVendor) {
    vendorId = existingVendor.id;
  } else {
    const { data: newVendor, error: vendorErr } = await supabase
      .from("vendor")
      .insert({ user_id: user.id, name: VENDOR_NAME })
      .select("id")
      .single();
    if (vendorErr || !newVendor) return { status: "error", message: "지출처 생성에 실패했습니다" };
    vendorId = newVendor.id;
  }

  if (replaceExisting) {
    const { data: existingRecord } = await supabase
      .from("utility_bill_record")
      .select("transaction_id")
      .eq("period", extraction.period)
      .maybeSingle();
    if (existingRecord) {
      // transaction 삭제 → utility_bill_record(ON DELETE CASCADE) → utility_bill_item_value
      // (ON DELETE CASCADE) 순으로 연쇄 삭제됨(데이터구조설계 §3-2).
      await supabase.from("transaction").delete().eq("id", existingRecord.transaction_id);
    }
  }

  const { data: tx, error: txErr } = await supabase
    .from("transaction")
    .insert({
      user_id: user.id,
      payment_method_id: paymentMethodId,
      category_id: category.id,
      vendor_id: vendorId,
      input_type: "MANUAL",
      amount: extraction.total,
      has_detail: false,
      occurred_at: occurredAtDate,
      raw_payload: extraction as unknown as Json,
    })
    .select("id")
    .single();
  if (txErr || !tx) return { status: "error", message: "지출 등록에 실패했습니다" };

  const { data: record, error: recordErr } = await supabase
    .from("utility_bill_record")
    .insert({
      user_id: user.id,
      period: extraction.period,
      transaction_id: tx.id,
      source: "UPLOAD",
    })
    .select("id")
    .single();
  if (recordErr || !record) return { status: "error", message: "관리비 등록에 실패했습니다" };

  // usageTable(사용량별 지침표)의 전기/수도 사용요금은 items의 "전기료(세대)"/
  // "수도료(세대)"로 이미 금액이 반영돼 있다(2026-07-14, extractUtilityFeeItems) — 여기서
  // usageTable을 별도로 다시 저장하면 같은 금액이 두 번 쌓인다. 대신 전월/당월/사용량
  // 상세만 해당 items 행에 붙여서 저장한다.
  const usageByLabel = new Map(
    [
      [ELECTRICITY_SEDAE_LABEL, extraction.usageTable.find((u) => u.item === "전기")],
      [WATER_SEDAE_LABEL, extraction.usageTable.find((u) => u.item === "수도")],
    ].filter((entry): entry is [string, (typeof extraction.usageTable)[number]] => entry[1] != null)
  );
  const savableItems = extraction.items.map((i) => {
    const usage = usageByLabel.get(i.label);
    return {
      label: i.label,
      amount: i.amount,
      hasUsage: usage != null,
      usageValue: usage?.usageValue ?? null,
      meterPrevious: usage?.meterPrevious ?? null,
      meterCurrent: usage?.meterCurrent ?? null,
    };
  });

  for (const item of savableItems) {
    const { data: existingItem } = await supabase
      .from("utility_bill_item")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", item.label)
      .maybeSingle();

    let itemId: string;
    if (existingItem) {
      itemId = existingItem.id;
    } else {
      const { data: newItem, error: itemErr } = await supabase
        .from("utility_bill_item")
        .insert({
          user_id: user.id,
          name: item.label,
          has_usage: item.hasUsage,
          source_labels: [item.label],
        })
        .select("id")
        .single();
      if (itemErr || !newItem) continue; // 개별 항목 실패는 건너뛰고 계속 진행(전체 저장을 막지 않음)
      itemId = newItem.id;
    }

    const { error: valueErr } = await supabase.from("utility_bill_item_value").insert({
      record_id: record.id,
      item_id: itemId,
      amount: item.amount,
      usage_value: item.usageValue,
      meter_previous: item.meterPrevious,
      meter_current: item.meterCurrent,
    });
    // 개별 항목 실패는 여기서도 utility_bill_item과 동일하게 건너뛰고 계속 진행하지만
    // (전체 저장을 막지 않음), 서버 로그에는 남겨서 조용히 사라지지 않게 한다 —
    // amount CHECK 제약(0 금지) 위반처럼 특정 항목만 저장이 안 되는 경우를 놓치기 쉬웠다
    // (2026-07-14, 음수 금액 CHECK 제약 발견 계기).
    if (valueErr) {
      console.error(`utility_bill_item_value insert failed for "${item.label}":`, valueErr.message);
    }
  }

  // 원본 파일을 이제서야 Storage에 저장한다(F-2-1-2에서 청구월 확정 전까지 미뤄둔 단계).
  // 같은 경로에 이미 파일이 있으면(재업로드) createSignedUploadUrl이 거부하므로 먼저 제거.
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${extraction.period}.${ext}`;
  await supabase.storage.from(UTILITY_BILLS_BUCKET).remove([path]);
  const { data: signed } = await supabase.storage
    .from(UTILITY_BILLS_BUCKET)
    .createSignedUploadUrl(path);
  if (signed) {
    // Storage 저장 실패는 핵심 데이터(지출/통계) 저장에 영향 없어 에러로 만들지 않는다.
    await supabase.storage.from(UTILITY_BILLS_BUCKET).uploadToSignedUrl(path, signed.token, file);
  }

  revalidatePath("/expenses");
  revalidatePath("/utility-bills/upload");

  return { status: "success" };
}
