import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { periodRegex } from "@/lib/budget-schemas";
import { BudgetSection } from "./BudgetSection";

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

  const [{ data: categories }, { data: budgets }, { data: budgetTotal }, { data: transactions }] =
    await Promise.all([
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
    ]);

  // 예산 소진율 게이지(F-1-7-2) 계산용 — Phase 1은 MV 없이 이 화면에서만 쓰는 단순 직접 집계
  // (S-1-15의 대시보드 전용 집계 쿼리와는 별개, 대상 범위가 작아 직접 계산으로 충분).
  const actualByCategory: Record<string, number> = {};
  let totalActual = 0;
  for (const tx of transactions ?? []) {
    totalActual += tx.amount;
    actualByCategory[tx.category_id] = (actualByCategory[tx.category_id] ?? 0) + tx.amount;
  }

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
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
          />
        </section>
      </div>
    </div>
  );
}
