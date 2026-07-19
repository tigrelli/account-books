import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { formatCurrencySigned } from "@account-books/utils";
import {
  getUtilityBillChangeRate,
  getUtilityBillItemTrend,
  getUtilityBillLatestItemBreakdown,
  getUtilityBillTotalTrend,
  TOP_CHANGED_ITEM_LIMIT,
} from "@/lib/utility-bill-stats-queries";
import { TotalTrendChart } from "./TotalTrendChart";
import { ItemTrendChart } from "./ItemTrendChart";
import { ItemShareDonutChart } from "./ItemShareDonutChart";

// 업로드 직후 같은 통계를 바로 볼 수 있어야 하므로(홈/지출 목록과 동일 원칙) 캐시하지 않는다.
export const dynamic = "force-dynamic";

const yearRegex = /^\d{4}$/;

function currentYear(): string {
  return String(new Date().getFullYear());
}

export default async function UtilityBillStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { year: yearParam } = await searchParams;
  const year = yearParam && yearRegex.test(yearParam) ? yearParam : currentYear();

  const [totalTrend, itemTrend, changeRate, itemBreakdown] = await Promise.all([
    getUtilityBillTotalTrend(supabase, year),
    getUtilityBillItemTrend(supabase, year),
    getUtilityBillChangeRate(supabase),
    getUtilityBillLatestItemBreakdown(supabase),
  ]);
  const isIncrease = changeRate.changeRate !== null && changeRate.changeRate > 0;

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">명세서 통계</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              등록된 관리비 명세서의 연간 추이입니다
            </p>
          </div>
          <Link
            href="/utility-bills/upload"
            prefetch={false}
            className="shrink-0 text-sm font-medium text-[var(--paylens-action)] hover:underline"
          >
            명세서 업로드
          </Link>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/utility-bills/stats?year=${Number(year) - 1}`}
            prefetch={false}
            className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
          >
            ← {Number(year) - 1}년
          </Link>
          <p className="font-mono text-sm font-bold text-[var(--color-text-primary)]">{year}년</p>
          <Link
            href={`/utility-bills/stats?year=${Number(year) + 1}`}
            prefetch={false}
            className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
          >
            {Number(year) + 1}년 →
          </Link>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="mb-2 text-sm text-[var(--color-text-secondary)]">총액 추이</p>
          <TotalTrendChart data={totalTrend} />
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-[var(--color-text-secondary)]">전월 대비</p>
          {changeRate.changeRate === null ? (
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              비교할 {changeRate.currentTotal === null ? "이번 달" : "전월"} 데이터 없음
            </p>
          ) : (
            <p
              className={`mt-2 font-mono text-2xl font-bold ${isIncrease ? "text-[var(--paylens-accent)]" : "text-[var(--color-text-primary)]"}`}
            >
              {formatCurrencySigned(
                (changeRate.currentTotal ?? 0) - (changeRate.previousTotal ?? 0)
              )}
              <span className="ml-1 text-base font-semibold">
                ({changeRate.changeRate > 0 ? "+" : ""}
                {Math.round(changeRate.changeRate * 100)}%)
              </span>
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-[var(--color-text-secondary)]">항목별 추이</p>
          {itemTrend.totalActiveItemCount > TOP_CHANGED_ITEM_LIMIT && (
            <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
              전체 {itemTrend.totalActiveItemCount}개 항목 중 최근 3개월 변화가 큰 상위{" "}
              {TOP_CHANGED_ITEM_LIMIT}개만 표시합니다
            </p>
          )}
          <ItemTrendChart items={itemTrend.items} points={itemTrend.points} />
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="mb-2 text-sm text-[var(--color-text-secondary)]">이번 달 항목별 비중</p>
          <ItemShareDonutChart data={itemBreakdown} />
        </section>
      </div>
    </div>
  );
}
