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
      {/* 캘린더(F-1-10-1)와 동일한 근거로 확장 — 월별추이/지출분류별 차트는 내부가 w-full이라
          넓을수록 유리. 1920px(FHD)까지는 100%로 차오르고 QHD/4K에서만 상한 역할(태블릿/모바일은
          영향 없음). 카테고리별 도넛은 원 자체가 sm:w-56 고정폭이라 이 변경으로 커지지 않음 — 옆
          범례 목록만 여유가 생김. */}
      <div className="mx-auto max-w-[1920px] space-y-6">
        {/* "홈" 타이틀(사이드바에 이미 강조 표시되어 중복)은 제거하고, 유일한 "몇 월 데이터를 보고
            있는지" 표시였던 기간 텍스트는 카드로 승격 + 자주 쓰는 바로가기 2개(캘린더/지출 입력)를
            같은 카드 안에 나란히 배치 — 버튼이 텍스트 없이 혼자 떠 있지 않도록 균형을 맞춤. */}
        <section className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-[var(--color-text-secondary)]">이번달 지출 요약</p>
            <p className="mt-1 font-mono text-2xl font-bold text-[var(--color-text-primary)]">
              {period}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/expenses/calendar"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--paylens-action)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0f766e] active:bg-[#0d6b63]"
            >
              📅 캘린더 바로가기
            </Link>
            <Link
              href="/expenses/create"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--paylens-action)] px-4 text-sm font-semibold text-[var(--paylens-action)] transition-colors hover:bg-[var(--paylens-action)]/5"
            >
              + 지출 입력
            </Link>
          </div>
        </section>

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
