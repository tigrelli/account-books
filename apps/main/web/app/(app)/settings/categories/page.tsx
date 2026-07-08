import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { PaginationNav } from "../../_components/PaginationNav";
import { CategorySection } from "./CategorySection";

const PAGE_SIZE = 20;

export default async function CategoriesPage({
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

  const { data: categories, count } = await supabase
    .from("category")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  const rows = categories ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageHref = (targetPage: number) => `/settings/categories?page=${targetPage}`;

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">지출항목 관리</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            지출 항목을 등록하고 관리하세요 · 총 {totalCount.toLocaleString("ko-KR")}건
          </p>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <CategorySection categories={rows} />

          {rows.length > 0 && (
            <PaginationNav page={page} totalPages={totalPages} buildHref={pageHref} />
          )}
        </section>
      </div>
    </div>
  );
}
