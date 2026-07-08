"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQuery, keepPreviousData } from "@tanstack/react-query";
import { PaymentMethodTag } from "./PaymentMethodTag";
import { useViewportTier } from "@/lib/useViewportTier";
import { encodeExpenseCursor } from "@/lib/expense-cursor";
import type { ExpenseListFilters, ExpenseListRow } from "@/lib/expense-list-query";

const MOBILE_LIMIT = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function buildFilterParams(filters: ExpenseListFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.paymentMethodId) params.set("paymentMethodId", filters.paymentMethodId);
  if (filters.vendorId) params.set("vendorId", filters.vendorId);
  return params;
}

async function fetchOffsetPage(
  filters: ExpenseListFilters,
  page: number,
  pageSize: number
): Promise<{ rows: ExpenseListRow[]; totalCount: number }> {
  const params = buildFilterParams(filters);
  params.set("mode", "offset");
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  const res = await fetch(`/api/expenses?${params.toString()}`);
  if (!res.ok) throw new Error("지출 내역을 불러오지 못했습니다");
  return res.json();
}

async function fetchCursorPage(
  filters: ExpenseListFilters,
  cursor: string | null
): Promise<{ rows: ExpenseListRow[]; nextCursor: string | null }> {
  const params = buildFilterParams(filters);
  params.set("mode", "cursor");
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(MOBILE_LIMIT));
  const res = await fetch(`/api/expenses?${params.toString()}`);
  if (!res.ok) throw new Error("지출 내역을 불러오지 못했습니다");
  return res.json();
}

function ExpenseRow({ tx, editHref }: { tx: ExpenseListRow; editHref: string }) {
  const paymentMethod = tx.payment_method;
  const detailCount = tx.transaction_detail?.[0]?.count ?? 0;

  return (
    <Link
      href={editHref}
      prefetch={false}
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
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="space-y-2 text-center">
      <p className="text-sm text-[var(--color-text-secondary)]">
        {hasFilter ? "조건에 맞는 지출 내역이 없습니다" : "아직 등록된 지출이 없습니다"}
      </p>
      {hasFilter ? (
        <Link
          href="/expenses"
          prefetch={false}
          className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
        >
          필터 초기화
        </Link>
      ) : (
        <Link
          href="/expenses/create"
          prefetch={false}
          className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
        >
          지출 입력하러 가기
        </Link>
      )}
    </div>
  );
}

export function ExpensesListClient({
  initialRows,
  initialTotalCount,
  filters,
  initialPage,
  hasFilter,
}: {
  initialRows: ExpenseListRow[];
  initialTotalCount: number;
  filters: ExpenseListFilters;
  initialPage: number;
  hasFilter: boolean;
}) {
  const router = useRouter();
  const tier = useViewportTier();
  const [page, setPage] = useState(initialPage);

  // SSR은 항상 desktop 기준(pageSize=20)으로 initialPage를 해석했다 — 실제 tier가 desktop이
  // 아닌 것으로 밝혀지면(마운트 직후 1회, tier가 기본값 "desktop"에서 실제 값으로 바뀌는 순간) 그
  // tier의 1페이지로 되돌리고, 이후 실제 리사이즈로 tier 자체가 바뀔 때도 동일하게 리셋한다(기기별
  // 페이지 크기가 달라 딥링크된 페이지 번호를 그대로 재현할 수 없음 — PM 승인된 트레이드오프).
  // 렌더 중 이전 값과 비교하는 패턴(useEffect+setState 캐스케이드 회피 — CLAUDE.md 컨벤션).
  const [prevTier, setPrevTier] = useState(tier);
  if (tier !== prevTier) {
    setPrevTier(tier);
    setPage(1);
  }

  // 페이지 전환 시 풀 네비게이션 없이 데이터만 바뀌지만, "목록으로 돌아가기" 위치 기억을 위해
  // 얕은(shallow) URL 동기화는 유지한다. 모바일은 무한 스크롤이라 페이지 번호 개념이 없어 제외.
  useEffect(() => {
    if (tier === "mobile") return;
    const params = buildFilterParams(filters);
    params.set("page", String(page));
    router.replace(`/expenses?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, page]);

  const pageSize = tier === "tablet" ? 15 : 20;

  // staleTime을 주지 않으면(기본 0) initialData가 있어도 마운트 시 백그라운드 refetch가 즉시
  // 일어나 "첫 방문엔 추가 요청 없음"이라는 목표가 깨진다 — 서버가 준 초기 데이터를 잠시(30초)
  // 신선한 것으로 취급해 그 사이엔 재조회하지 않게 한다.
  const INITIAL_DATA_STALE_TIME = 30_000;

  const offsetQuery = useQuery({
    queryKey: ["expenses-offset", filters, tier, page, pageSize],
    queryFn: () => fetchOffsetPage(filters, page, pageSize),
    enabled: tier !== "mobile",
    placeholderData: keepPreviousData,
    staleTime: INITIAL_DATA_STALE_TIME,
    initialData: () =>
      tier === "desktop" && page === initialPage
        ? { rows: initialRows.slice(0, pageSize), totalCount: initialTotalCount }
        : tier === "tablet" && page === 1
          ? { rows: initialRows.slice(0, pageSize), totalCount: initialTotalCount }
          : undefined,
  });

  const infiniteQuery = useInfiniteQuery({
    queryKey: ["expenses-cursor", filters],
    queryFn: ({ pageParam }: { pageParam: string | null }) => fetchCursorPage(filters, pageParam),
    enabled: tier === "mobile",
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: { nextCursor: string | null }) => lastPage.nextCursor,
    staleTime: INITIAL_DATA_STALE_TIME,
    initialData: () => {
      if (initialPage !== 1) return undefined;
      const rows = initialRows.slice(0, MOBILE_LIMIT);
      const hasMore = initialRows.length > MOBILE_LIMIT;
      const lastRow = rows[rows.length - 1];
      const nextCursor =
        hasMore && lastRow
          ? encodeExpenseCursor({ occurredAt: lastRow.occurred_at, id: lastRow.id })
          : null;
      return { pages: [{ rows, nextCursor }], pageParams: [null] };
    },
  });

  function editHrefFor(txId: string): string {
    const params = buildFilterParams(filters);
    if (tier !== "mobile") params.set("page", String(page));
    return `/expenses/${txId}/edit?from=${encodeURIComponent(`/expenses?${params.toString()}`)}`;
  }

  if (tier === "mobile") {
    const rows =
      infiniteQuery.data?.pages.flatMap((p) => p.rows) ?? initialRows.slice(0, MOBILE_LIMIT);

    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        {rows.length === 0 ? (
          <EmptyState hasFilter={hasFilter} />
        ) : (
          <>
            <div className="space-y-2">
              {rows.map((tx) => (
                <ExpenseRow key={tx.id} tx={tx} editHref={editHrefFor(tx.id)} />
              ))}
            </div>
            {infiniteQuery.hasNextPage && (
              <div className="mt-4 flex justify-center border-t border-[#e2e8f0] pt-4">
                <button
                  type="button"
                  onClick={() => infiniteQuery.fetchNextPage()}
                  disabled={infiniteQuery.isFetchingNextPage}
                  className="text-sm font-medium text-[var(--paylens-action)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {infiniteQuery.isFetchingNextPage ? "불러오는 중…" : "더보기"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    );
  }

  const rows = offsetQuery.data?.rows ?? initialRows.slice(0, pageSize);
  const totalCount = offsetQuery.data?.totalCount ?? initialTotalCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      {rows.length === 0 ? (
        <EmptyState hasFilter={hasFilter} />
      ) : (
        <div className="space-y-2">
          {rows.map((tx) => (
            <ExpenseRow key={tx.id} tx={tx} editHref={editHrefFor(tx.id)} />
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-[#e2e8f0] pt-4">
          {page > 1 ? (
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
            >
              ← 이전
            </button>
          ) : (
            <span />
          )}
          <span className="text-xs text-[var(--color-text-secondary)]">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
            >
              다음 →
            </button>
          ) : (
            <span />
          )}
        </div>
      )}
    </section>
  );
}
