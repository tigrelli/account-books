import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { ExpenseFilters, type ExpenseFilterValues } from "./ExpenseFilters";
import { ExpensesListClient } from "./ExpensesListClient";
import { fetchExpensesOffset } from "@/lib/expense-list-query";

// 매번 최신 지출 내역을 보여줘야 하므로 캐시하지 않음 — supabase-js의 fetch 호출이
// Next.js Data Cache에 걸려 방금 저장한 항목이 누락되는 문제 방지.
export const dynamic = "force-dynamic";

// Desktop 기준 pageSize — 목록 렌더링/기기별 페이지 크기는 ExpensesListClient(Client Component)가
// 맡고, 여기서는 지금까지와 동일하게 딱 한 번만(page=1 또는 URL의 ?page=) 초기 데이터를 가져와
// 넘긴다. Tablet/Mobile은 이 20건 중 앞부분을 슬라이스해 첫 화면을 그리므로 추가 요청이 없다.
const PAGE_SIZE = 20;

type ExpensesSearchParams = ExpenseFilterValues & { page?: string };

export default async function ExpensesListPage({
  searchParams,
}: {
  searchParams: Promise<ExpensesSearchParams>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const {
    page: pageParam,
    from: fromDate,
    to: toDate,
    categoryId,
    paymentMethodId,
    vendorId,
  } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const filterValues: ExpenseFilterValues = {
    from: fromDate,
    to: toDate,
    categoryId,
    paymentMethodId,
    vendorId,
  };
  const hasFilter = Object.values(filterValues).some(Boolean);
  const filterQuery = new URLSearchParams(
    Object.entries(filterValues).filter((entry): entry is [string, string] => Boolean(entry[1]))
  ).toString();

  const [{ data: categories }, { data: paymentMethods }, { data: vendors }, { rows, totalCount }] =
    await Promise.all([
      supabase
        .from("category")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("payment_method")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("vendor")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      fetchExpensesOffset(supabase, filterValues, page, PAGE_SIZE),
    ]);

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">지출 내역</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              총 {totalCount.toLocaleString("ko-KR")}건
            </p>
          </div>
          <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm">
            <Link
              href="/expenses/calendar"
              prefetch={false}
              className="rounded-md px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--paylens-bg)]"
            >
              캘린더
            </Link>
            <span className="rounded-md bg-[var(--paylens-action)]/10 px-3 py-1.5 text-sm font-medium text-[var(--paylens-action)]">
              목록
            </span>
          </div>
        </div>

        <ExpenseFilters
          categories={categories ?? []}
          paymentMethods={paymentMethods ?? []}
          vendors={vendors ?? []}
          values={filterValues}
        />

        <ExpensesListClient
          key={filterQuery}
          initialRows={rows}
          initialTotalCount={totalCount}
          filters={filterValues}
          initialPage={page}
          hasFilter={hasFilter}
        />
      </div>
    </div>
  );
}
