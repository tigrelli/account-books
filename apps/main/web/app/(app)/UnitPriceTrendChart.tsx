"use client";

import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@account-books/utils";
import type { UnitPriceOption, UnitPriceTrendPoint } from "@/lib/dashboard-queries";

function formatMonthLabel(period: string): string {
  return `${Number(period.split("-")[1])}월`;
}

function optionKey(option: Pick<UnitPriceOption, "itemId" | "unitId">): string {
  return `${option.itemId}:${option.unitId}`;
}

function CompactTooltip({
  active,
  payload,
  unitName,
}: {
  active?: boolean;
  payload?: { payload: UnitPriceTrendPoint }[];
  unitName: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point || point.avgUnitPrice === null) return null;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 shadow-sm">
      <p className="text-xs text-[var(--color-text-secondary)]">{point.period}</p>
      <p className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
        {formatCurrency(point.avgUnitPrice)} / {unitName}
      </p>
      <p className="text-xs text-[var(--color-text-secondary)]">
        총 {point.totalQuantity.toLocaleString("ko-KR")}
        {unitName}
      </p>
    </div>
  );
}

// F-3-1-4: 품목×단위 평균 단가 추이 — 구조화된 수량(quantity_value+unit_id)이 있는 조합만 select로
// 고를 수 있다(item_unit_stats, S-3-3이 애초에 그 조건만 집계). 선택은 URL 쿼리(?unitItem=)로
// 관리해 새로고침/공유해도 유지되도록 함(예산/캘린더의 ?period= 패턴과 동일한 방식).
export function UnitPriceTrendChart({
  period,
  options,
  selectedKey,
  trend,
  unitName,
}: {
  period: string;
  options: UnitPriceOption[];
  selectedKey: string;
  trend: UnitPriceTrendPoint[];
  unitName: string;
}) {
  const router = useRouter();

  if (options.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
        구조화된 수량(예: &ldquo;2개&rdquo;, &ldquo;1kg&rdquo;)으로 입력된 상세항목이 아직 없어요
      </p>
    );
  }

  const hasAnyData = trend.some((point) => point.avgUnitPrice !== null);

  return (
    <div>
      <select
        value={selectedKey}
        onChange={(e) => {
          const params = new URLSearchParams({ period, unitItem: e.target.value });
          router.push(`/?${params.toString()}`, { scroll: false });
        }}
        className="mb-3 h-9 rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm outline-none focus:border-[var(--paylens-action)]"
      >
        {options.map((option) => (
          <option key={optionKey(option)} value={optionKey(option)}>
            {option.itemName} ({option.unitName})
          </option>
        ))}
      </select>

      {hasAnyData ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="period"
              tickFormatter={formatMonthLabel}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
            />
            <YAxis
              tickFormatter={(value: number) => value.toLocaleString("ko-KR")}
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            />
            <Tooltip content={<CompactTooltip unitName={unitName} />} />
            <Area
              type="monotone"
              dataKey="avgUnitPrice"
              connectNulls
              stroke="var(--paylens-main)"
              strokeWidth={2}
              fill="var(--paylens-main)"
              fillOpacity={0.1}
              dot={{ r: 4, fill: "var(--paylens-main)", stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: "var(--paylens-main)", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
          최근 기간에는 이 조합으로 기록된 지출이 없어요
        </p>
      )}
    </div>
  );
}
