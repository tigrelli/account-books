import type { createSupabaseServerClient } from "@account-books/supabase-client";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// [F-2-4-6] 관리비 업로드(utility-bills/actions.ts)에서도 같은 규칙으로 지출처를 쓰도록 expenses/actions.ts에서
// 옮김 — "use server" 파일에서 export하면 클라이언트가 호출 가능한 서버 액션이 되므로 lib에 둔다.
// 지출처는 사전 등록이 필수가 아님 — 정확히 일치하는 이름이 있으면 재사용, 없으면 그 자리에서 새로 등록.
// 2026-07-03 PM 결정: 지출처는 여러 카테고리의 지출이 섞일 수 있어(예: GS슈퍼에서 식료품+의류) 특정
// 카테고리에 고정 매칭하지 않음 — default_category_id는 항상 null(컬럼 자체는 유지, 지출처 관리 화면 참고).
export async function resolveVendorId(
  supabase: SupabaseServerClient,
  userId: string,
  vendorName: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("vendor")
    .select("id, is_active")
    .eq("user_id", userId)
    .eq("name", vendorName)
    .maybeSingle();

  if (existing) {
    // 비활성화했던 지출처를 다시 지출 입력에 쓰면 자동완성 목록에도 다시 노출되도록 재활성화.
    if (!existing.is_active) {
      await supabase.from("vendor").update({ is_active: true }).eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created } = await supabase
    .from("vendor")
    .insert({ user_id: userId, name: vendorName })
    .select("id")
    .single();

  return created?.id ?? null;
}
