import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { ItemSection } from "./ItemSection";

export default async function ItemsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: items }, { data: categories }] = await Promise.all([
    // 병합된 품목은 대상 품목(merged_into_item_id)의 별칭으로 흡수된 것으로 취급 — 목록엔 안 보임(F-1-6-3 병합 화면 참고).
    supabase
      .from("item")
      .select("*")
      .is("merged_into_item_id", null)
      .order("name", { ascending: true }),
    supabase.from("category").select("*"),
  ]);

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <Link href="/settings" className="text-sm text-[var(--paylens-action)] hover:underline">
            ← 계정 설정으로
          </Link>
          <h1 className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">품목 관리</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            지출 입력 시 자동으로 쌓인 상세항목(품목) 목록입니다. 비슷한 품목을 병합하면 과거 지출은
            즉시 하나로 합산되고, 앞으로 같은 이름으로 다시 입력해도(자동완성에서 제안을 고르지 않고
            직접 타이핑해도) 자동으로 병합된 품목으로 기록되어 품목별 통계(Top10 등)에서 계속 하나로
            집계됩니다.
          </p>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <ItemSection items={items ?? []} categories={categories ?? []} />
        </section>
      </div>
    </div>
  );
}
