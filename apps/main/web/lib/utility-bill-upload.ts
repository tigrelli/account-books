import { createSupabaseBrowserClient } from "@account-books/supabase-client";

const UTILITY_BILLS_BUCKET = "utility-bills";

export type UploadUtilityBillFileResult = { success: true } | { success: false; message: string };

/**
 * createUploadUrlAction(actions.ts)이 발급한 path/token으로 Storage에 직접 업로드한다.
 * 브라우저 → Supabase Storage 직접 전송이라 Next.js 서버(Vercel 함수 4.5MB 본문 제한)를
 * 거치지 않는다(관리비명세서_데이터구조설계.md §5).
 */
export async function uploadUtilityBillFile(
  file: File,
  path: string,
  token: string
): Promise<UploadUtilityBillFileResult> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(UTILITY_BILLS_BUCKET)
    .uploadToSignedUrl(path, token, file);

  if (error) {
    return { success: false, message: "파일 업로드에 실패했습니다" };
  }
  return { success: true };
}
