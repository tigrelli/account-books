"use client";

import { useState, useTransition } from "react";
import { formatCurrency } from "@account-books/utils";
import { getItemVendorBreakdown, type ItemVendorBreakdownEntry } from "./actions";
import type { ItemTop10DisplayEntry } from "@/lib/dashboard-queries";

// F-3-1-3: 상세항목 Top10 + 드릴다운. 다른 위젯(F-1-8-2/F-3-1-1/F-3-1-2)과 달리 "품목 클릭 →
// 그 자리에서 지출처별 내역 펼치기" 아코디언 상호작용이 필요해, Recharts 대신 순수 HTML/CSS 막대로
// 직접 구현(막대 하나 아래에 별도 패널을 붙이는 건 Recharts 마크 모델과 잘 맞지 않음). 마크 스펙은
// dataviz 스킬 기준을 그대로 따름 — 단일 색(--paylens-main), 막대 끝 금액 직접 라벨.
export function ItemTop10Chart({
  data,
  period,
}: {
  data: ItemTop10DisplayEntry[];
  period: string;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [breakdownByItem, setBreakdownByItem] = useState<
    Record<string, ItemVendorBreakdownEntry[]>
  >({});
  const [isPending, startTransition] = useTransition();

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
        아직 지출 내역이 없어요
      </p>
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
        const result = await getItemVendorBreakdown(item.itemId, period);
        setBreakdownByItem((prev) => ({ ...prev, [item.itemId]: result }));
      });
    }
  }

  return (
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
                      <span className="text-[var(--color-text-secondary)]">{entry.vendorName}</span>
                      <span className="font-mono text-[var(--color-text-primary)]">
                        {formatCurrency(entry.total)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--color-text-secondary)]">지출처 정보가 없어요</p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
