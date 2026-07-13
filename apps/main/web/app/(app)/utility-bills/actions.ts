"use server";

import { createSupabaseServerClient } from "@account-books/supabase-client";
import { createUploadUrlSchema, type CreateUploadUrlInput } from "@/lib/utility-bill-schemas";

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
