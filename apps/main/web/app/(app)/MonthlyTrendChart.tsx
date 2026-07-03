"use client";

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
import type { MonthlyTrendPoint } from "@/lib/dashboard-queries";

function formatMonthLabel(period: string): string {
  return `${Number(period.split("-")[1])}월`;
}

function CompactTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: MonthlyTrendPoint }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 shadow-sm">
      <p className="text-xs text-[var(--color-text-secondary)]">{point.period}</p>
      <p className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
        {formatCurrency(point.total)}
      </p>
    </div>
  );
}

// F-1-8-2: 최근 N개월 지출 추이 — 단일 시리즈라 범례 없음(제목이 대신함), 축/그리드는 최대한 절제.
export function MonthlyTrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  const hasSpending = data.some((point) => point.total > 0);

  if (!hasSpending) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
        아직 지출 내역이 없어요
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
        <Tooltip content={<CompactTooltip />} />
        <Area
          type="monotone"
          dataKey="total"
          stroke="var(--paylens-main)"
          strokeWidth={2}
          fill="var(--paylens-main)"
          fillOpacity={0.1}
          dot={{ r: 4, fill: "var(--paylens-main)", stroke: "#fff", strokeWidth: 2 }}
          activeDot={{ r: 6, fill: "var(--paylens-main)", stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
