"use server";

import { createSupabaseServerClient } from "@account-books/supabase-client";
import { createUploadUrlSchema, type CreateUploadUrlInput } from "@/lib/utility-bill-schemas";
import { createOCRProvider } from "@/lib/ocr";
import {
  parseUtilityBillCandidates,
  type UtilityBillLineCandidate,
} from "@/lib/utility-bill-parse";

// [S-2-5]에서 만든 비공개 버킷. 경로 규칙: {user_id}/{period}.{ext}.
export const UTILITY_BILLS_BUCKET = "utility-bills";

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
  | { status: "success"; candidates: UtilityBillLineCandidate[] }
  | { status: "error"; message: string };

/**
 * 업로드된 파일(createUploadUrlAction으로 저장된 경로)을 OCR로 읽어 라벨/금액 후보를
 * 추출한다. 항목 선정 화면(F-2-2-1)이 이 후보를 사용자에게 보여주고 최종 선택은
 * 사람이 한다 — 여기서는 후보만 만든다.
 */
export async function extractUtilityBillAction(path: string): Promise<ExtractUtilityBillResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "로그인이 필요합니다" };

  // Storage RLS가 어차피 타 사용자 경로 다운로드를 막지만, 더 명확한 에러 메시지를 위해
  // 여기서도 한 번 더 확인한다(createUploadUrlAction과 동일한 방어 원칙).
  if (!path.startsWith(`${user.id}/`)) {
    return { status: "error", message: "잘못된 요청입니다" };
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(UTILITY_BILLS_BUCKET)
    .download(path);
  if (downloadError || !file) {
    return { status: "error", message: "파일을 불러오지 못했습니다" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const provider = createOCRProvider();
    const ocrResult = await provider.extractText(buffer);
    const candidates = parseUtilityBillCandidates(ocrResult);
    return { status: "success", candidates };
  } catch {
    return { status: "error", message: "OCR 처리에 실패했습니다" };
  }
}
