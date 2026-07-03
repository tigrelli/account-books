import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { formatCurrency, formatCurrencySigned } from "@account-books/utils";
import {
  getCategoryBreakdown,
  getDashboardSummary,
  getMonthlyTrend,
  getPaymentMethodBreakdown,
} from "@/lib/dashboard-queries";
import { BudgetGauge } from "./budgets/BudgetGauge";
import { MonthlyTrendChart } from "./MonthlyTrendChart";
import { CategoryBreakdownChart } from "./CategoryBreakdownChart";
import { PaymentMethodBreakdownChart } from "./PaymentMethodBreakdownChart";

const TREND_MONTHS = 6;

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const period = currentPeriod();
  const [summary, trend, categoryBreakdown, paymentMethodBreakdown] = await Promise.all([
    getDashboardSummary(supabase, period),
    getMonthlyTrend(supabase, period, TREND_MONTHS),
    getCategoryBreakdown(supabase, period),
    getPaymentMethodBreakdown(supabase, period),
  ]);
  const isIncrease = summary.changeRate !== null && summary.changeRate > 0;

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">홈</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{period} 지출 요약</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-[var(--color-text-secondary)]">이번달 총지출</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[var(--color-text-primary)]">
              {formatCurrency(summary.totalThisMonth)}
            </p>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-[var(--color-text-secondary)]">전월 대비</p>
            {summary.changeRate === null ? (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                비교할 전월 데이터 없음
              </p>
            ) : (
              <p
                className={`mt-2 font-mono text-2xl font-bold ${isIncrease ? "text-[var(--paylens-accent)]" : "text-[var(--color-text-primary)]"}`}
              >
                {formatCurrencySigned(summary.totalThisMonth - summary.totalLastMonth)}
                <span className="ml-1 text-base font-semibold">
                  ({summary.changeRate > 0 ? "+" : ""}
                  {Math.round(summary.changeRate * 100)}%)
                </span>
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-[var(--color-text-secondary)]">예산 소진율</p>
            {summary.budgetLimit === null ? (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                <Link
                  href="/budgets"
                  className="font-medium text-[var(--paylens-action)] hover:underline"
                >
                  예산을 설정
                </Link>
                하면 소진율을 볼 수 있어요
              </p>
            ) : (
              <div className="mt-3">
                <BudgetGauge spent={summary.totalThisMonth} limit={summary.budgetLimit} />
              </div>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="mb-2 text-sm text-[var(--color-text-secondary)]">
              최근 {TREND_MONTHS}개월 지출 추이
            </p>
            <MonthlyTrendChart data={trend} />
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="mb-2 text-sm text-[var(--color-text-secondary)]">
              이번달 카테고리별 지출
            </p>
            <CategoryBreakdownChart data={categoryBreakdown} />
          </section>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="mb-2 text-sm text-[var(--color-text-secondary)]">이번달 지출분류별 지출</p>
          <PaymentMethodBreakdownChart data={paymentMethodBreakdown} />
        </section>
      </div>
    </div>
  );
}
