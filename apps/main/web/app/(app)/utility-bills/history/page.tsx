import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { toYearMonth } from "@account-books/utils";
import { addMonthsToPeriod } from "@/lib/period-utils";
import {
  getUtilityBillHistoryPanels,
  getEarliestUtilityBillPeriod,
} from "@/lib/utility-bill-history-queries";
import { UtilityBillHistoryClient } from "./UtilityBillHistoryClient";

// 업로드 직후 같은 이력을 바로 볼 수 있어야 하므로(통계 화면과 동일 원칙) 캐시하지 않는다.
export const dynamic = "force-dynamic";

const periodRegex = /^\d{4}-\d{2}$/;

export default async function UtilityBillHistoryPage({
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
  const currentPeriod = toYearMonth(new Date());
  const centerPeriod = periodParam && periodRegex.test(periodParam) ? periodParam : currentPeriod;
  const prevPeriod = addMonthsToPeriod(centerPeriod, -1);
  const nextPeriod = addMonthsToPeriod(centerPeriod, 1);

  const [panelsMap, earliestPeriod] = await Promise.all([
    getUtilityBillHistoryPanels(supabase, [prevPeriod, centerPeriod, nextPeriod]),
    getEarliestUtilityBillPeriod(supabase),
  ]);

  const hasAnyHistory = earliestPeriod !== null;
  const canGoPrev = hasAnyHistory && centerPeriod > earliestPeriod;
  const canGoNext = centerPeriod < currentPeriod;
  const panels = Object.fromEntries(panelsMap);

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      {/* 다른 화면(폼 위주)은 가독성을 위해 좁게 유지하지만, 이 화면은 3개월을 나란히 비교하는
          게 핵심이라 캘린더(F-1-10-1)와 동일하게 1920px(FHD)까지는 화면 폭에 맞춰 100%로
          차오르게 한다(PM 요청, 2026-07-19 — 3칸 비교 시 폭을 최대한 활용). */}
      <div className="mx-auto max-w-[1920px] space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">명세서 이력</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              등록된 관리비 명세서를 월별 원본 내역으로 확인하세요
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/utility-bills/stats"
              prefetch={false}
              className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
            >
              명세서 통계
            </Link>
            <Link
              href="/utility-bills/upload"
              prefetch={false}
              className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
            >
              명세서 업로드
            </Link>
          </div>
        </div>

        <UtilityBillHistoryClient
          centerPeriod={centerPeriod}
          prevPeriod={prevPeriod}
          nextPeriod={nextPeriod}
          panels={panels}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          hasAnyHistory={hasAnyHistory}
        />
      </div>
    </div>
  );
}
