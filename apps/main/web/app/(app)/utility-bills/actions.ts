"use server";

import { createSupabaseServerClient } from "@account-books/supabase-client";
import { createUploadUrlSchema, type CreateUploadUrlInput } from "@/lib/utility-bill-schemas";
import { createOCRProvider } from "@/lib/ocr";
import { extractUtilityBill, type UtilityBillExtraction } from "@/lib/utility-bill-parse";

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
