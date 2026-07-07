import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { periodRegex } from "@/lib/budget-schemas";
import { BudgetSection } from "./BudgetSection";

// 지출 목록/캘린더(F-1-1-11, F-1-10-1)와 동일하게 명시 — 이 화면도 예산 등록/초기화/"지난달
// 예산 불러오기"(F-1-7-3) 등 뮤테이션 직후 같은 경로를 다시 봐야 하므로, supabase-js의 fetch
// 호출이 Next.js Data Cache에 걸려 오래된 값이 보이는 일이 없도록 캐시하지 않는다.
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

export default async function BudgetsPage({
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
  const period = periodParam && periodRegex.test(periodParam) ? periodParam : currentPeriod();

  const periodStart = new Date(`${period}-01`);
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1);
  const previousPeriod = shiftPeriod(period, -1);

  const [
    { data: categories },
    { data: budgets },
    { data: budgetTotal },
    { data: transactions },
    { data: previousBudgets },
    { data: previousBudgetTotal },
  ] = await Promise.all([
    supabase
      .from("category")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase.from("budget").select("*").eq("period", period),
    supabase.from("budget_total").select("*").eq("period", period).maybeSingle(),
    supabase
      .from("transaction")
      .select("category_id, amount")
      .gte("occurred_at", periodStart.toISOString())
      .lt("occurred_at", periodEnd.toISOString()),
    // F-1-7-3 리뷰: "지난달 예산 불러오기" 버튼용 — 지난달에 예산이 아예 없으면 버튼을
    // 비활성화해야 하므로 페이지 로드 시 함께 가져온다(버튼 클릭 시점의 별도 조회 대신).
    supabase.from("budget").select("category_id, limit_amount").eq("period", previousPeriod),
    supabase.from("budget_total").select("*").eq("period", previousPeriod).maybeSingle(),
  ]);

  // 예산 소진율 게이지(F-1-7-2) 계산용 — Phase 1은 MV 없이 이 화면에서만 쓰는 단순 직접 집계
  // (S-1-15의 대시보드 전용 집계 쿼리와는 별개, 대상 범위가 작아 직접 계산으로 충분).
  const actualByCategory: Record<string, number> = {};
  let totalActual = 0;
  for (const tx of transactions ?? []) {
    totalActual += tx.amount;
    actualByCategory[tx.category_id] = (actualByCategory[tx.category_id] ?? 0) + tx.amount;
  }

  const previousCategoryAmounts: Record<string, number> = {};
  for (const b of previousBudgets ?? []) {
    previousCategoryAmounts[b.category_id] = b.limit_amount;
  }

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      {/* 카테고리 수가 많아지면 1열 목록이 세로로 너무 길어져(F-1-7-3 리뷰) — 캘린더(F-1-10-1)처럼
          max-w-[1920px]까지 넓히는 것도 검토했으나, 캘린더의 날짜 셀과 달리 예산 행은 폭이 늘어나도
          채울 내용(라벨+금액 입력+"원")이 늘지 않아 1920px 컨테이너에서는 카드 안에 빈 공간만
          커지는 문제가 있었음(스크린샷 검증 결과). 그래서 모바일은 기존 폭(max-w-xl) 그대로 두고,
          BudgetSection이 2열 그리드로 전환되는 md(태블릿) 이상에서만 2열에 맞는 폭(max-w-4xl)으로 넓힘. */}
      <div className="mx-auto max-w-xl space-y-6 md:max-w-4xl">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">예산 관리</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            전체 예산을 등록한 뒤 카테고리별로 배분하세요
          </p>
        </div>

        <div className="flex items-center justify-between">
          <Link
            href={`/budgets?period=${shiftPeriod(period, -1)}`}
            className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
          >
            ← 이전 달
          </Link>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">{period}</span>
          <Link
            href={`/budgets?period=${shiftPeriod(period, 1)}`}
            className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
          >
            다음 달 →
          </Link>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <BudgetSection
            key={period}
            categories={categories ?? []}
            budgets={budgets ?? []}
            budgetTotal={budgetTotal ?? undefined}
            actualByCategory={actualByCategory}
            totalActual={totalActual}
            period={period}
            previousTotalAmount={previousBudgetTotal?.limit_amount}
            previousCategoryAmounts={previousCategoryAmounts}
          />
        </section>
      </div>
    </div>
  );
}
