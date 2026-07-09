"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatCurrency } from "@account-books/utils";
import { getItemVendorBreakdown, type ItemVendorBreakdownEntry } from "./actions";
import type { ItemTop10DisplayEntry } from "@/lib/dashboard-queries";

const ITEM_RANGE_OPTIONS = [1, 3, 6] as const;
type ItemRange = (typeof ITEM_RANGE_OPTIONS)[number];

const RANGE_LABELS: Record<ItemRange, string> = {
  1: "당월",
  3: "최근 3개월",
  6: "최근 6개월",
};

// period(끝 달)에서 monthsBack개월 전 "YYYY-MM"을 계산 — 탭 아래 기간 라벨 표시용.
// page.tsx/stats-cache.ts의 shiftPeriod와 동일한 계산이지만, 이 파일은 클라이언트 컴포넌트라
// 서버 전용 모듈을 import할 수 없어 동일 로직을 이 파일 안에 작게 다시 둔다.
function periodMonthsAgo(period: string, monthsBack: number): string {
  const parts = period.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const shifted = new Date(year, month - 1 - (monthsBack - 1), 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

// F-3-1-3: 상세항목 Top10 + 드릴다운. 다른 위젯(F-1-8-2/F-3-1-1/F-3-1-2)과 달리 "품목 클릭 →
// 그 자리에서 지출처별 내역 펼치기" 아코디언 상호작용이 필요해, Recharts 대신 순수 HTML/CSS 막대로
// 직접 구현(막대 하나 아래에 별도 패널을 붙이는 건 Recharts 마크 모델과 잘 맞지 않음). 마크 스펙은
// dataviz 스킬 기준을 그대로 따름 — 단일 색(--paylens-main), 막대 끝 금액 직접 라벨.
//
// monthsBack(2026-07-09 PM 요청): 다른 위젯이 전부 공유하는 페이지 전역 period 이동과는 별개로,
// 이 위젯만 "당월/최근 3개월/최근 6개월" 합산을 고를 수 있게 자체 쿼리 파라미터(itemRange)를 둔다
// — 전역 이전달/다음달 링크를 건드리지 않기 위해서다.
// 탭 Link는 scroll={false} 필수 — 기본값(scroll 유지)이면 페이지 하단 이 위젯을 보다가 탭을
// 눌러도 Next.js가 새 내비게이션마다 스크롤을 맨 위로 올려버려, 그래프만 바뀌길 기대한 사용자가
// "화면이 새로고침된 것처럼" 느끼는 버그가 있었음(PM 리포트로 발견).
export function ItemTop10Chart({
  data,
  period,
  monthsBack,
}: {
  data: ItemTop10DisplayEntry[];
  period: string;
  monthsBack: ItemRange;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [breakdownByItem, setBreakdownByItem] = useState<
    Record<string, ItemVendorBreakdownEntry[]>
  >({});
  const [isPending, startTransition] = useTransition();

  const rangeTabs = (
    <div className="mb-3 flex items-center gap-3">
      <div className="flex gap-1 rounded-lg bg-[var(--paylens-bg)] p-1">
        {ITEM_RANGE_OPTIONS.map((range) => (
          <Link
            key={range}
            href={`/?period=${period}&itemRange=${range}`}
            prefetch={false}
            scroll={false}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              range === monthsBack
                ? "bg-white text-[var(--paylens-action)] shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {RANGE_LABELS[range]}
          </Link>
        ))}
      </div>
      {monthsBack > 1 && (
        <span className="text-xs text-[var(--color-text-secondary)]">
          {periodMonthsAgo(period, monthsBack)} ~ {period}
        </span>
      )}
    </div>
  );

  if (data.length === 0) {
    return (
      <div>
        {rangeTabs}
        <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
          아직 지출 내역이 없어요
        </p>
      </div>
    );
  }

  const maxAmount = Math.max(...data.map((item) => item.totalAmount));

  function handleToggle(item: ItemTop10DisplayEntry) {
    if (expandedItemId === item.itemId) {
      setExpandedItemId(null);
      return;
    }
    setExpandedItemId(item.itemId);
    if (!breakdownByItem[item.itemId]) {
      startTransition(async () => {
        const result = await getItemVendorBreakdown(item.itemId, period, monthsBack);
        setBreakdownByItem((prev) => ({ ...prev, [item.itemId]: result }));
      });
    }
  }

  return (
    <>
      {rangeTabs}
      <ul className="space-y-1">
        {data.map((item) => {
          const isExpanded = expandedItemId === item.itemId;
          const widthPercent = maxAmount > 0 ? (item.totalAmount / maxAmount) * 100 : 0;
          const breakdown = breakdownByItem[item.itemId];

          return (
            <li key={item.itemId}>
              <button
                type="button"
                onClick={() => handleToggle(item)}
                aria-expanded={isExpanded}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--paylens-bg)]"
              >
                <span className="w-24 shrink-0 truncate text-sm text-[var(--color-text-secondary)]">
                  {item.itemName}
                </span>
                <span className="h-6 flex-1 overflow-hidden rounded-md bg-[var(--paylens-bg)]">
                  <span
                    className="block h-full rounded-r-md bg-[var(--paylens-main)]"
                    style={{ width: `${widthPercent}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right font-mono text-sm font-semibold text-[var(--color-text-primary)]">
                  {formatCurrency(item.totalAmount)}
                </span>
              </button>

              {isExpanded && (
                <div className="mt-1 ml-4 space-y-1.5 rounded-lg bg-[var(--paylens-bg)] p-3">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    지출처별 구매 내역
                  </p>
                  {isPending && !breakdown ? (
                    <p className="text-xs text-[var(--color-text-secondary)]">불러오는 중…</p>
                  ) : breakdown && breakdown.length > 0 ? (
                    breakdown.map((entry) => (
                      <div
                        key={entry.vendorName}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-[var(--color-text-secondary)]">
                          {entry.vendorName}
                        </span>
                        <span className="font-mono text-[var(--color-text-primary)]">
                          {formatCurrency(entry.total)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      지출처 정보가 없어요
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
