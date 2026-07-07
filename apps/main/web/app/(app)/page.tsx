import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { formatCurrency, formatCurrencySigned } from "@account-books/utils";
import { periodRegex } from "@/lib/budget-schemas";
import {
  getCategoryBreakdown,
  getDashboardSummary,
  getMonthlyTrend,
  getPaymentMethodBreakdown,
  getVendorTopN,
  getItemTop10Display,
  getUnitPriceOptions,
  getUnitPriceTrend,
} from "@/lib/dashboard-queries";
import { BudgetGauge } from "./budgets/BudgetGauge";
import { MonthlyTrendChart } from "./MonthlyTrendChart";
import { CategoryBreakdownChart } from "./CategoryBreakdownChart";
import { PaymentMethodBreakdownChart } from "./PaymentMethodBreakdownChart";
import { VendorTopNChart } from "./VendorTopNChart";
import { ItemTop10Chart } from "./ItemTop10Chart";
import { UnitPriceTrendChart } from "./UnitPriceTrendChart";

const TREND_MONTHS = 6;

// 예산/캘린더 화면과 동일하게 뮤테이션(지출 등록 등) 직후에도 최신 데이터를 봐야 하므로 캐시하지 않음.
export const dynamic = "force-dynamic";

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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; unitItem?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { period: periodParam, unitItem: unitItemParam } = await searchParams;
  const period = periodParam && periodRegex.test(periodParam) ? periodParam : currentPeriod();
  const [
    summary,
    trend,
    categoryBreakdown,
    paymentMethodBreakdown,
    vendorTopN,
    itemTop10,
    unitPriceOptions,
  ] = await Promise.all([
    getDashboardSummary(supabase, period),
    getMonthlyTrend(supabase, period, TREND_MONTHS),
    getCategoryBreakdown(supabase, period),
    getPaymentMethodBreakdown(supabase, period),
    getVendorTopN(supabase, period),
    getItemTop10Display(supabase, user.id, period),
    getUnitPriceOptions(supabase, period, TREND_MONTHS),
  ]);
  const isIncrease = summary.changeRate !== null && summary.changeRate > 0;

  // F-3-1-4: ?unitItem=itemId:unitId가 선택 목록에 없으면(잘못된 값/최초 진입) 가장 많이 기록된
  // 조합을 기본값으로 — select 자체가 항상 유효한 선택지를 보여줘야 하므로 여기서 폴백을 정한다.
  const selectedUnitOption =
    unitPriceOptions.find((option) => `${option.itemId}:${option.unitId}` === unitItemParam) ??
    unitPriceOptions[0];
  const unitPriceTrend = selectedUnitOption
    ? await getUnitPriceTrend(
        supabase,
        selectedUnitOption.itemId,
        selectedUnitOption.unitId,
        period,
        TREND_MONTHS
      )
    : [];

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      {/* 캘린더(F-1-10-1)와 동일한 근거로 확장 — 월별추이/지출분류별 차트는 내부가 w-full이라
          넓을수록 유리. 1920px(FHD)까지는 100%로 차오르고 QHD/4K에서만 상한 역할(태블릿/모바일은
          영향 없음). 카테고리별 도넛은 원 자체가 sm:w-56 고정폭이라 이 변경으로 커지지 않음 — 옆
          범례 목록만 여유가 생김. */}
      <div className="mx-auto max-w-[1920px] space-y-6">
        {/* "홈" 타이틀(사이드바에 이미 강조 표시되어 중복)은 제거하고, 유일한 "몇 월 데이터를 보고
            있는지" 표시였던 기간 텍스트는 카드로 승격 + 자주 쓰는 바로가기 2개(캘린더/지출 입력)를
            같은 카드 안에 나란히 배치 — 버튼이 텍스트 없이 혼자 떠 있지 않도록 균형을 맞춤.
            예산/캘린더 화면과 동일하게 이전/다음 달 이동을 추가(PM 요청, 2026-07-07) — 더 이상 항상
            "이번달"이 아니므로 라벨에서 "이번달"을 빼고 기간 숫자로만 어느 달인지 나타낸다. */}
        <section className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-[var(--color-text-secondary)]">지출 요약</p>
            <div className="mt-1 flex items-center gap-3">
              <Link
                href={`/?period=${shiftPeriod(period, -1)}`}
                className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
              >
                ← 이전 달
              </Link>
              <p className="font-mono text-2xl font-bold text-[var(--color-text-primary)]">
                {period}
              </p>
              <Link
                href={`/?period=${shiftPeriod(period, 1)}`}
                className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
              >
                다음 달 →
              </Link>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/expenses/calendar?period=${period}`}
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
            <p className="text-sm text-[var(--color-text-secondary)]">총지출</p>
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
            <p className="mb-2 text-sm text-[var(--color-text-secondary)]">카테고리별 지출</p>
            <CategoryBreakdownChart data={categoryBreakdown} />
          </section>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="mb-2 text-sm text-[var(--color-text-secondary)]">지출분류별 지출</p>
            <PaymentMethodBreakdownChart data={paymentMethodBreakdown} />
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="mb-2 text-sm text-[var(--color-text-secondary)]">지출처 Top 10</p>
            <VendorTopNChart data={vendorTopN} />
          </section>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="mb-2 text-sm text-[var(--color-text-secondary)]">
            상세항목 Top 10 <span className="text-xs font-normal">(클릭하면 지출처별 내역)</span>
          </p>
          <ItemTop10Chart data={itemTop10} period={period} />
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="mb-2 text-sm text-[var(--color-text-secondary)]">
            단가 분석 <span className="text-xs font-normal">(품목×단위별 평균가 추이)</span>
          </p>
          <UnitPriceTrendChart
            period={period}
            options={unitPriceOptions}
            selectedKey={
              selectedUnitOption ? `${selectedUnitOption.itemId}:${selectedUnitOption.unitId}` : ""
            }
            trend={unitPriceTrend}
            unitName={selectedUnitOption?.unitName ?? ""}
          />
        </section>
      </div>
    </div>
  );
}
