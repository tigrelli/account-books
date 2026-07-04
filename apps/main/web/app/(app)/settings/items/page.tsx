import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { PaginationNav } from "../../_components/PaginationNav";
import { ItemSection } from "./ItemSection";

const PAGE_SIZE = 20;

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  const [{ data: items, count }, { data: allItems }, { data: categories }] = await Promise.all([
    // 병합된 품목은 대상 품목(merged_into_item_id)의 별칭으로 흡수된 것으로 취급 — 목록엔 안 보임(F-1-6-3 병합 화면 참고).
    supabase
      .from("item")
      .select("*", { count: "exact" })
      .is("merged_into_item_id", null)
      .order("name", { ascending: true })
      .range(rangeFrom, rangeTo),
    // 병합 대상 드롭다운은 현재 페이지에 없는 품목도 선택할 수 있어야 하므로 페이징 없이 전체 조회.
    supabase
      .from("item")
      .select("id, name")
      .is("merged_into_item_id", null)
      .order("name", { ascending: true }),
    supabase.from("category").select("*"),
  ]);

  const rows = items ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageHref = (targetPage: number) => `/settings/items?page=${targetPage}`;

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">품목 관리</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            지출 입력 시 자동으로 쌓인 상세항목(품목) 목록입니다. 비슷한 품목을 병합하면 과거 지출은
            즉시 하나로 합산되고, 앞으로 같은 이름으로 다시 입력해도(자동완성에서 제안을 고르지 않고
            직접 타이핑해도) 자동으로 병합된 품목으로 기록되어 품목별 통계(Top10 등)에서 계속 하나로
            집계됩니다. · 총 {totalCount.toLocaleString("ko-KR")}건
          </p>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <ItemSection items={rows} allItems={allItems ?? []} categories={categories ?? []} />

          {rows.length > 0 && (
            <PaginationNav page={page} totalPages={totalPages} buildHref={pageHref} />
          )}
        </section>
      </div>
    </div>
  );
}
