import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { isAdminEmail } from "@/lib/admin";
import { SynonymSection } from "./SynonymSection";

// F-3-1-5: 동의어 사전 관리(운영자 전용). 사이드바에서도 운영자에게만 보이지만(AppShell), 그건
// UI 노출일 뿐 — 여기서도 다시 확인해 일반 사용자가 URL을 직접 알아내도 들어올 수 없게 막는다.
export default async function SynonymsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/");

  const { data: rows } = await supabase
    .from("synonym_dictionary")
    .select("*")
    .order("group_key", { ascending: true })
    .order("term", { ascending: true });

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">동의어 사전 관리</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            운영자 전용 — 지출 입력의 유사 항목 제안(F-1-5-7)이 참고하는 전체 사용자 공통 사전입니다
          </p>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <SynonymSection rows={rows ?? []} />
        </section>
      </div>
    </div>
  );
}
