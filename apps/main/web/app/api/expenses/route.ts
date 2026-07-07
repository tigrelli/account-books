import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import {
  fetchExpensesCursor,
  fetchExpensesOffset,
  type ExpenseListFilters,
} from "@/lib/expense-list-query";

// 지출 내역 목록을 기기별로(Desktop/Tablet=페이지네이션, Mobile=더보기) 클라이언트에서 다시
// 불러오기 위한 API — 이 앱의 첫 Route Handler. 인증은 middleware.ts가 우선 막아주지만,
// fetch()가 302 리다이렉트 HTML을 그대로 받아 JSON 파싱에 실패하는 걸 막기 위해 여기서도
// 명시적으로 401을 반환한다.
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const filters: ExpenseListFilters = {
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    categoryId: params.get("categoryId") ?? undefined,
    paymentMethodId: params.get("paymentMethodId") ?? undefined,
    vendorId: params.get("vendorId") ?? undefined,
  };

  const mode = params.get("mode");

  if (mode === "cursor") {
    const cursor = params.get("cursor");
    const limit = Math.max(1, Number(params.get("limit")) || 10);
    const { rows, nextCursor } = await fetchExpensesCursor(supabase, filters, cursor, limit);
    return NextResponse.json({ rows, nextCursor });
  }

  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.max(1, Number(params.get("pageSize")) || 20);
  const { rows, totalCount } = await fetchExpensesOffset(supabase, filters, page, pageSize);
  return NextResponse.json({ rows, totalCount });
}
