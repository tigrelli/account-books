"use client";

import Link from "next/link";
import { useViewportTier } from "@/lib/useViewportTier";
import type { UtilityBillHistoryPanel } from "@/lib/utility-bill-history-queries";
import { MonthPanel } from "./MonthPanel";

function NavArrow({
  direction,
  period,
  enabled,
}: {
  direction: "prev" | "next";
  period: string;
  enabled: boolean;
}) {
  const symbol = direction === "prev" ? "←" : "→";
  const className =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-medium";

  if (!enabled) {
    return (
      <span
        aria-disabled="true"
        className={`${className} cursor-not-allowed bg-white/50 text-[var(--color-text-secondary)]/40 shadow-sm`}
      >
        {symbol}
      </span>
    );
  }

  return (
    <Link
      href={`/utility-bills/history?period=${period}`}
      prefetch={false}
      aria-label={direction === "prev" ? "이전 달" : "다음 달"}
      className={`${className} bg-white text-[var(--paylens-action)] shadow-sm hover:bg-[var(--paylens-action)]/5`}
    >
      {symbol}
    </Link>
  );
}

// [F-2-4-4] 웹/태블릿(md 이상)은 이전/현재/다음 3개월을 나란히 비교, 모바일은 현재 달 1개만
// 보여주고 화살표로 이동(PM 확인, 2026-07-19) — 3칸 그리드가 좁은 화면에 들어가지 않아서다.
// 화살표는 인접 달에 등록이 없어도 계속 활성 상태(빈 달은 MonthPanel이 안내 문구/총액만
// 표시) — 전체 조회 가능 기간의 양끝(오늘이 속한 달 / 최초 등록월)에서만 비활성화된다.
export function UtilityBillHistoryClient({
  centerPeriod,
  prevPeriod,
  nextPeriod,
  panels,
  canGoPrev,
  canGoNext,
  hasAnyHistory,
}: {
  centerPeriod: string;
  prevPeriod: string;
  nextPeriod: string;
  panels: Record<string, UtilityBillHistoryPanel>;
  canGoPrev: boolean;
  canGoNext: boolean;
  hasAnyHistory: boolean;
}) {
  const tier = useViewportTier();

  if (!hasAnyHistory) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-sm text-[var(--color-text-secondary)] shadow-sm">
        아직 등록된 관리비 명세서가 없습니다
      </div>
    );
  }

  const isMobile = tier === "mobile";
  const periods = isMobile ? [centerPeriod] : [prevPeriod, centerPeriod, nextPeriod];

  return (
    <div className="flex items-start gap-3">
      <NavArrow direction="prev" period={prevPeriod} enabled={canGoPrev} />

      <div className={`grid flex-1 gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
        {periods.map((period) => (
          <MonthPanel
            key={period}
            period={period}
            panel={panels[period]}
            highlight={period === centerPeriod}
          />
        ))}
      </div>

      <NavArrow direction="next" period={nextPeriod} enabled={canGoNext} />
    </div>
  );
}
