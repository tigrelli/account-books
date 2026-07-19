import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { ExpenseCalendarGrid } from "./ExpenseCalendarGrid";

// 지출 목록(F-1-1-11)과 동일하게 항상 최신 데이터를 보여줘야 함 — 빠른 입력 팝업 저장 직후에도
// Data Cache로 인해 방금 저장한 항목이 누락되는 문제 방지.
export const dynamic = "force-dynamic";

const PERIOD_REGEX = /^\d{4}-\d{2}$/;

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftPeriod(period: string, delta: number): string {
  const parts = period.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const shifted = new Date(year, month - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

// F-1-10-1: 지출 내역 캘린더 조회 — /expenses(목록)와 같은 데이터를 월별 그리드로 보여주는 대안 뷰.
export default async function ExpenseCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { period: periodParam } = await searchParams;
  const period = periodParam && PERIOD_REGEX.test(periodParam) ? periodParam : currentPeriod();
  const periodParts = period.split("-");
  const year = Number(periodParts[0]);
  const month = Number(periodParts[1]);
  // 그리드는 6주(42칸) 고정이라 이번 달 앞뒤로 옆 달 날짜도 흐리게 함께 보여줌(ExpenseCalendarGrid의
  // buildMonthGrid와 동일 로직으로 계산) — 조회 범위를 이번 달로만 좁히면 그 흐린 칸(예: 5월 그리드에
  // 함께 보이는 4월 30일)에 실제 등록된 지출이 있어도 표시되지 않으므로, 그리드가 실제로 보여주는
  // 42일 전체를 범위로 조회한다.
  const firstOfMonth = new Date(year, month - 1, 1);
  const rangeStart = new Date(year, month - 1, 1 - firstOfMonth.getDay());
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeStart.getDate() + 42);

  const [
    { data: paymentMethods },
    { data: categories },
    { data: vendors },
    { data: items },
    { data: units },
    { data: transactions },
  ] = await Promise.all([
    supabase
      .from("payment_method")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("category")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("vendor")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("item")
      .select("*")
      .is("merged_into_item_id", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("unit")
      .select("*")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: true }),
    supabase
      .from("transaction")
      .select(
        "*, category(name, icon), vendor(name), payment_method(display_name, type, card_kind, subtype), transaction_detail(*), utility_bill_record(id, source)"
      )
      .gte("occurred_at", rangeStart.toISOString())
      .lt("occurred_at", rangeEnd.toISOString())
      .order("occurred_at", { ascending: true }),
  ]);

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      {/* 다른 화면(폼 위주)은 가독성을 위해 max-w-xl로 좁게 유지하지만, 캘린더는 격자형 데이터라
          넓을수록 유리 — 1920px(FHD, 가장 흔한 데스크탑 해상도)까지는 화면 폭에 맞춰 100%로
          차오르고(사이드바+여백을 뺀 실제 콘텐츠 폭은 FHD에서도 항상 1920px보다 좁아 이 상한선이
          사실상 작동하지 않음), QHD/4K 같은 초대형 모니터에서만 셀이 과도하게 늘어나지 않도록
          상한선 역할(태블릿/모바일은 당연히 더 좁아서 영향 없음). */}
      <div className="mx-auto max-w-[1920px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">지출 내역</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              날짜별 지출 내역을 캘린더로 확인하세요
            </p>
          </div>
          <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm">
            <span className="rounded-md bg-[var(--paylens-action)]/10 px-3 py-1.5 text-sm font-medium text-[var(--paylens-action)]">
              캘린더
            </span>
            <Link
              href="/expenses"
              prefetch={false}
              className="rounded-md px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--paylens-bg)]"
            >
              목록
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
          <Link
            href={`/expenses/calendar?period=${shiftPeriod(period, -1)}`}
            prefetch={false}
            className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
          >
            ← 이전 달
          </Link>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">{period}</span>
          <Link
            href={`/expenses/calendar?period=${shiftPeriod(period, 1)}`}
            prefetch={false}
            className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
          >
            다음 달 →
          </Link>
        </div>

        <ExpenseCalendarGrid
          year={year}
          month={month}
          transactions={transactions ?? []}
          paymentMethods={paymentMethods ?? []}
          categories={categories ?? []}
          vendors={vendors ?? []}
          items={items ?? []}
          units={units ?? []}
        />
      </div>
    </div>
  );
}
