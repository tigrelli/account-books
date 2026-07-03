"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@account-books/utils";
import type { CategoryBreakdownItem } from "@/lib/dashboard-queries";

// F-1-8-3 전용 카테고리 팔레트(dataviz 스킬로 검증) — CVD 인접쌍/명도/채도/대비 6항목 전부 PASS.
// 인디고-로즈-앰버-바이올렛-그린-레드 순서는 인접쌍 CVD를 최대화하도록 고정한 순서라 임의로 바꾸지 말 것.
// 브랜드 예약색(경고 --paylens-accent, 액션 --paylens-action, 결제수단 태그 cash/check/credit)과는
// 의도적으로 겹치지 않는 색상만 사용 — 다른 화면의 의미(경고/CTA/결제수단)와 혼동되지 않도록.
const CATEGORY_PALETTE = ["#4338CA", "#DB2777", "#A16207", "#9333EA", "#15803D", "#B91C1C"];
const OTHER_COLOR = "#64748B";
const MAX_SLICES = 6;

interface DonutSlice {
  categoryId: string;
  categoryName: string;
  total: number;
  color: string;
}

function paletteColor(i: number): string {
  return CATEGORY_PALETTE[i] ?? OTHER_COLOR;
}

function buildSlices(items: CategoryBreakdownItem[]): DonutSlice[] {
  if (items.length <= MAX_SLICES) {
    return items.map((item, i) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      total: item.total,
      color: paletteColor(i),
    }));
  }

  const top = items.slice(0, MAX_SLICES - 1).map((item, i) => ({
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    total: item.total,
    color: paletteColor(i),
  }));
  const otherTotal = items.slice(MAX_SLICES - 1).reduce((sum, item) => sum + item.total, 0);

  return [
    ...top,
    { categoryId: "__other__", categoryName: "기타", total: otherTotal, color: OTHER_COLOR },
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
  const percent = total > 0 ? Math.round((slice.total / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 shadow-sm">
      <p className="text-xs text-[var(--color-text-secondary)]">{slice.categoryName}</p>
      <p className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
        {formatCurrency(slice.total)}
        <span className="ml-1 text-xs font-normal text-[var(--color-text-secondary)]">
          ({percent}%)
        </span>
      </p>
    </div>
  );
}

// F-1-8-3: 이번달 카테고리별(항목별) 지출 도넛 차트 — 최대 6구간, 초과분은 "기타"로 병합.
export function CategoryBreakdownChart({ data }: { data: CategoryBreakdownItem[] }) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
        아직 지출 내역이 없어요
      </p>
    );
  }

  const slices = buildSlices(data);
  const total = slices.reduce((sum, slice) => sum + slice.total, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="h-56 w-full shrink-0 sm:w-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="categoryName"
              innerRadius="60%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
            >
              {slices.map((slice) => (
                <Cell key={slice.categoryId} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<CompactTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="w-full space-y-2">
        {slices.map((slice) => {
          const percent = total > 0 ? Math.round((slice.total / total) * 100) : 0;
          return (
            <li key={slice.categoryId} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="flex-1 truncate text-[var(--color-text-primary)]">
                {slice.categoryName}
              </span>
              <span className="font-mono text-[var(--color-text-secondary)]">
                {formatCurrency(slice.total)} · {percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
