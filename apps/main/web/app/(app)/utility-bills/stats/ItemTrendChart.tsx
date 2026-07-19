"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@account-books/utils";
import type {
  UtilityBillItemTrendItem,
  UtilityBillItemTrendPoint,
} from "@/lib/utility-bill-stats-queries";

// CategoryBreakdownChart.tsx와 동일 팔레트(dataviz 스킬로 검증됨, F-1-8-3) — 인접쌍 CVD를
// 최대화하도록 고정된 순서라 임의로 바꾸지 않는다. 항목 6개를 넘으면 그 이후는 공용 "기타" 색.
const ITEM_PALETTE = ["#4338CA", "#DB2777", "#A16207", "#9333EA", "#15803D", "#B91C1C"];
const OVERFLOW_COLOR = "#64748B";

function paletteColor(i: number): string {
  return ITEM_PALETTE[i] ?? OVERFLOW_COLOR;
}

function formatMonthLabel(period: string): string {
  return `${Number(period.split("-")[1])}월`;
}

function MultiSeriesTooltip({
  active,
  label,
  points,
  items,
  colorByItemId,
}: {
  active?: boolean;
  label?: string;
  points: UtilityBillItemTrendPoint[];
  items: UtilityBillItemTrendItem[];
  colorByItemId: Map<string, string>;
}) {
  if (!active || !label) return null;
  const point = points.find((p) => p.period === label);
  if (!point) return null;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 shadow-sm">
      <p className="mb-1 text-xs text-[var(--color-text-secondary)]">{label}</p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const amount = point.values[item.id];
          return (
            <li key={item.id} className="flex items-center gap-1.5 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: colorByItemId.get(item.id) }}
              />
              <span className="flex-1 text-[var(--color-text-secondary)]">{item.name}</span>
              <span className="font-mono font-medium text-[var(--color-text-primary)]">
                {amount == null ? "-" : formatCurrency(amount)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// F-2-3-2: 활성 항목별 월별 금액 추이 — 그 달에 값이 없는 항목은 선을 잇지 않고(connectNulls 없음)
// 툴팁에 "-"로 표시한다(화면설계 §3-1). 2개 이상 시리즈라 범례 항상 표시(dataviz 스킬 기준).
export function ItemTrendChart({
  items,
  points,
}: {
  items: UtilityBillItemTrendItem[];
  points: UtilityBillItemTrendPoint[];
}) {
  const hasData = points.some((point) => Object.values(point.values).some((v) => v != null));

  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
        등록된 항목이 없어요
      </p>
    );
  }

  if (!hasData) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
        아직 등록된 명세서가 없어요
      </p>
    );
  }

  const colorByItemId = new Map(items.map((item, i) => [item.id, paletteColor(i)]));

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            width={64}
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
          />
          <Tooltip
            content={
              <MultiSeriesTooltip points={points} items={items} colorByItemId={colorByItemId} />
            }
          />
          {items.map((item, i) => {
            const color = paletteColor(i);
            return (
              <Line
                key={item.id}
                type="monotone"
                dataKey={`values.${item.id}`}
                name={item.name}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 4, fill: color, stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: color, stroke: "#fff", strokeWidth: 2 }}
                connectNulls={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map((item, i) => (
          <li key={item.id} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: paletteColor(i) }}
            />
            <span className="text-[var(--color-text-secondary)]">{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
