import type { createSupabaseServerClient } from "@account-books/supabase-client";
import type { Database } from "@account-books/types";
import { encodeExpenseCursor, decodeExpenseCursor } from "./expense-cursor";

// @supabase/supabase-js는 apps/main/web의 직접 의존성이 아니라(패키지 경계 유지 —
// @account-books/supabase-client를 통해서만 접근) 그 타입을 직접 import할 수 없어,
// 이미 만들어진 서버 클라이언트의 반환 타입을 그대로 재사용한다.
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Server Component(page.tsx)와 Route Handler(app/api/expenses/route.ts)가 함께 쓰는 지출 목록
// 쿼리 로직 — 기기별 pageSize/커서 페이지네이션이 생기면서 두 곳에서 동일한 필터 적용 코드가
// 중복되지 않도록 여기에만 둔다.
const SELECT_COLUMNS =
  "*, category(name, icon), vendor(name), payment_method(display_name, type, card_kind, subtype), transaction_detail(count), utility_bill_record(id)";

export type ExpenseListRow = Database["public"]["Tables"]["transaction"]["Row"] & {
  category: Pick<Database["public"]["Tables"]["category"]["Row"], "name" | "icon"> | null;
  vendor: Pick<Database["public"]["Tables"]["vendor"]["Row"], "name"> | null;
  payment_method: Pick<
    Database["public"]["Tables"]["payment_method"]["Row"],
    "display_name" | "type" | "card_kind" | "subtype"
  > | null;
  transaction_detail: { count: number }[];
  // [F-2-4-1] 관리비 명세서 업로드로 등록된 트랜잭션인지 판별(목록 배지용) — transaction_id가
  // UNIQUE라 supabase-js가 1:1 관계로 추론해 배열이 아니라 단일 객체/null로 내려온다.
  utility_bill_record: { id: string } | null;
};

export type ExpenseListFilters = {
  from?: string | undefined;
  to?: string | undefined;
  categoryId?: string | undefined;
  paymentMethodId?: string | undefined;
  vendorId?: string | undefined;
};

export async function fetchExpensesOffset(
  supabase: SupabaseServerClient,
  filters: ExpenseListFilters,
  page: number,
  pageSize: number
): Promise<{ rows: ExpenseListRow[]; totalCount: number }> {
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let query = supabase.from("transaction").select(SELECT_COLUMNS, { count: "exact" });
  if (filters.from) query = query.gte("occurred_at", new Date(filters.from).toISOString());
  if (filters.to) query = query.lte("occurred_at", new Date(filters.to).toISOString());
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.paymentMethodId) query = query.eq("payment_method_id", filters.paymentMethodId);
  if (filters.vendorId) query = query.eq("vendor_id", filters.vendorId);

  const { data, count } = await query
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(rangeFrom, rangeTo);

  return { rows: (data ?? []) as ExpenseListRow[], totalCount: count ?? 0 };
}

export async function fetchExpensesCursor(
  supabase: SupabaseServerClient,
  filters: ExpenseListFilters,
  cursor: string | null,
  limit: number
): Promise<{ rows: ExpenseListRow[]; nextCursor: string | null }> {
  let query = supabase.from("transaction").select(SELECT_COLUMNS);
  if (filters.from) query = query.gte("occurred_at", new Date(filters.from).toISOString());
  if (filters.to) query = query.lte("occurred_at", new Date(filters.to).toISOString());
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.paymentMethodId) query = query.eq("payment_method_id", filters.paymentMethodId);
  if (filters.vendorId) query = query.eq("vendor_id", filters.vendorId);

  if (cursor) {
    const { occurredAt, id } = decodeExpenseCursor(cursor);
    // 정렬 기준(occurred_at desc, id desc)의 "직전 값보다 뒤"만 가져오는 키셋 조건.
    query = query.or(`occurred_at.lt.${occurredAt},and(occurred_at.eq.${occurredAt},id.lt.${id})`);
  }

  // 다음 페이지 존재 여부를 별도 count 쿼리 없이 알기 위해 limit보다 1개 더 가져온다.
  const { data } = await query
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  const rows = (data ?? []) as ExpenseListRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeExpenseCursor({ occurredAt: lastRow.occurred_at, id: lastRow.id })
      : null;

  return { rows: pageRows, nextCursor };
}
