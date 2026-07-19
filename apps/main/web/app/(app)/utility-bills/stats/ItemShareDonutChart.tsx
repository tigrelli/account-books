"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@account-books/utils";
import type { UtilityBillItemShare } from "@/lib/utility-bill-stats-queries";

// CategoryBreakdownChart.tsx(F-1-8-3)와 동일 팔레트(dataviz 스킬로 검증됨) — 인접쌍 CVD를
// 최대화하도록 고정된 순서라 임의로 바꾸지 않는다.
const PALETTE = ["#4338CA", "#DB2777", "#A16207", "#9333EA", "#15803D", "#B91C1C"];
const OTHER_COLOR = "#64748B";
const MAX_SLICES = 6;

interface DonutSlice {
  itemId: string;
  itemName: string;
  amount: number;
  color: string;
}

function paletteColor(i: number): string {
  return PALETTE[i] ?? OTHER_COLOR;
}

function buildSlices(items: UtilityBillItemShare[]): DonutSlice[] {
  if (items.length <= MAX_SLICES) {
    return items.map((item, i) => ({ ...item, color: paletteColor(i) }));
  }

  const top = items
    .slice(0, MAX_SLICES - 1)
    .map((item, i) => ({ ...item, color: paletteColor(i) }));
  const otherAmount = items.slice(MAX_SLICES - 1).reduce((sum, item) => sum + item.amount, 0);

  return [
    ...top,
    { itemId: "__other__", itemName: "기타", amount: otherAmount, color: OTHER_COLOR },
  ];
}

function CompactTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { payload: DonutSlice }[];
  total: number;
}) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) return null;
  const percent = total > 0 ? Math.round((slice.amount / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 shadow-sm">
      <p className="text-xs text-[var(--color-text-secondary)]">{slice.itemName}</p>
      <p className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
        {formatCurrency(slice.amount)}
        <span className="ml-1 text-xs font-normal text-[var(--color-text-secondary)]">
          ({percent}%)
        </span>
      </p>
    </div>
  );
}

// F-2-3-3: 이번 달 명세서의 항목별 비중 도넛 — 최대 6구간, 초과분은 "기타"로 병합
// (CategoryBreakdownChart와 동일 규칙, 화면설계 §3-1 "최근 달 기준").
export function ItemShareDonutChart({ data }: { data: UtilityBillItemShare[] }) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
        이번 달 등록된 명세서가 없어요
      </p>
    );
  }

  const slices = buildSlices(data);
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="h-56 w-full shrink-0 sm:w-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount"
              nameKey="itemName"
              innerRadius="60%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
            >
              {slices.map((slice) => (
                <Cell key={slice.itemId} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<CompactTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="w-full space-y-2">
        {slices.map((slice) => {
          const percent = total > 0 ? Math.round((slice.amount / total) * 100) : 0;
          return (
            <li key={slice.itemId} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="flex-1 truncate text-[var(--color-text-primary)]">
                {slice.itemName}
              </span>
              <span className="font-mono text-[var(--color-text-secondary)]">
                {formatCurrency(slice.amount)} · {percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
