"use server";

import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@account-books/supabase-client";
import { isAdminEmail } from "@/lib/admin";
import { synonymTermSchema } from "@/lib/synonym-schemas";

const PATH = "/admin/synonyms";

export type SynonymActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string }
  | { status: "validation_error"; errors: Partial<Record<string, string[]>> };

// SYNONYM_DICTIONARY는 RLS에 authenticated용 쓰기 정책 자체가 없다(데이터정책_및_시드정의서
// 3장, "운영자만") — 그래서 쓰기는 Service Role 클라이언트로만 가능한데, 그 전에 호출자가
// 진짜 운영자(ADMIN_EMAILS)인지 반드시 다시 확인한다. 사이드바에서 안 보이게 숨긴 것과는
// 별개로, 이 서버 액션이 실제 방어선 — 라우트를 직접 알아내 호출해도 여기서 막힌다.
async function requireAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return { ok: false, message: "권한이 없습니다" };
  }
  return { ok: true };
}

export async function addSynonymTermAction(
  _prev: SynonymActionState,
  formData: FormData
): Promise<SynonymActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error", message: auth.message };

  const parsed = synonymTermSchema.safeParse({
    groupKey: formData.get("groupKey"),
    term: formData.get("term"),
  });
  if (!parsed.success) {
    return {
      status: "validation_error",
      errors: parsed.error.flatten((i) => i.message).fieldErrors,
    };
  }

  const admin = await createSupabaseAdminClient();
  const { error } = await admin.from("synonym_dictionary").insert({
    group_key: parsed.data.groupKey,
    term: parsed.data.term,
  });
  if (error) {
    // (group_key, term) 유니크 제약 위반이 가장 흔한 케이스 — 이미 등록된 조합.
    return { status: "error", message: "이미 등록된 단어이거나 저장에 실패했습니다" };
  }

  revalidatePath(PATH);
  return { status: "success" };
}

export async function deleteSynonymTermAction(id: string): Promise<void> {
  const auth = await requireAdmin();
  if (!auth.ok) return; // 버튼 자체가 운영자에게만 보이므로, 여긴 우회 접근 방어용 조용한 무시.

  const admin = await createSupabaseAdminClient();
  await admin.from("synonym_dictionary").delete().eq("id", id);
  revalidatePath(PATH);
}
