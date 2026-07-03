import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { ExpenseFilters, type ExpenseFilterValues } from "./ExpenseFilters";
import { PaymentMethodTag } from "./PaymentMethodTag";

// 매번 최신 지출 내역을 보여줘야 하므로 캐시하지 않음 — supabase-js의 fetch 호출이
// Next.js Data Cache에 걸려 방금 저장한 항목이 누락되는 문제 방지.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

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
  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  const [{ data: categories }, { data: paymentMethods }, { data: vendors }] = await Promise.all([
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
  ]);

  let transactionQuery = supabase
    .from("transaction")
    .select(
      "*, category(name, icon), vendor(name), payment_method(display_name, type, card_kind), transaction_detail(count)",
      { count: "exact" }
    );

  if (fromDate)
    transactionQuery = transactionQuery.gte("occurred_at", new Date(fromDate).toISOString());
  if (toDate)
    transactionQuery = transactionQuery.lte("occurred_at", new Date(toDate).toISOString());
  if (categoryId) transactionQuery = transactionQuery.eq("category_id", categoryId);
  if (paymentMethodId) transactionQuery = transactionQuery.eq("payment_method_id", paymentMethodId);
  if (vendorId) transactionQuery = transactionQuery.eq("vendor_id", vendorId);

  const { data: transactions, count } = await transactionQuery
    .order("occurred_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  const rows = transactions ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
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
  const pageHref = (targetPage: number) =>
    `/expenses?${filterQuery ? `${filterQuery}&` : ""}page=${targetPage}`;

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">지출 내역</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            총 {totalCount.toLocaleString("ko-KR")}건
          </p>
        </div>

        <ExpenseFilters
          categories={categories ?? []}
          paymentMethods={paymentMethods ?? []}
          vendors={vendors ?? []}
          values={filterValues}
        />

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          {rows.length === 0 ? (
            <div className="space-y-2 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {hasFilter ? "조건에 맞는 지출 내역이 없습니다" : "아직 등록된 지출이 없습니다"}
              </p>
              {hasFilter ? (
                <Link
                  href="/expenses"
                  className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
                >
                  필터 초기화
                </Link>
              ) : (
                <Link
                  href="/expenses/create"
                  className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
                >
                  지출 입력하러 가기
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((tx) => {
                const paymentMethod = tx.payment_method;
                const detailCount = tx.transaction_detail?.[0]?.count ?? 0;

                return (
                  <Link
                    key={tx.id}
                    href={`/expenses/${tx.id}/edit`}
                    className="block rounded-lg border border-[#e2e8f0] p-3 hover:border-[var(--paylens-action)]"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[var(--color-text-primary)]">
                        {tx.category?.icon ? `${tx.category.icon} ` : ""}
                        {tx.category?.name ?? "-"}
                        <span className="mx-1.5 text-[var(--color-text-secondary)]">·</span>
                        {tx.vendor?.name ?? "-"}
                      </p>
                      <p className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
                        {tx.amount.toLocaleString("ko-KR")}원
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {formatDate(tx.occurred_at)}
                      <span className="mx-1.5">·</span>
                      {paymentMethod ? <PaymentMethodTag paymentMethod={paymentMethod} /> : "-"}
                      {tx.has_detail && (
                        <>
                          <span className="mx-1.5">·</span>
                          상세 {detailCount}건
                        </>
                      )}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-[#e2e8f0] pt-4">
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
                >
                  ← 이전
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-[var(--color-text-secondary)]">
                {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
                >
                  다음 →
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
