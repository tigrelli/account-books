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
import type { UtilityBillTotalTrendPoint } from "@/lib/utility-bill-stats-queries";

function formatMonthLabel(period: string): string {
  return `${Number(period.split("-")[1])}월`;
}

function CompactTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: UtilityBillTotalTrendPoint }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 shadow-sm">
      <p className="text-xs text-[var(--color-text-secondary)]">
        {point.period}
        {point.billedPeriod && ` (${formatMonthLabel(point.billedPeriod)})`}
      </p>
      <p className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
        {formatCurrency(point.total)}
      </p>
      {point.isManual && (
        <p className="mt-0.5 text-xs text-[var(--paylens-data-soft)]">수동 입력됨</p>
      )}
    </div>
  );
}

function TrendDot({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: UtilityBillTotalTrendPoint;
}) {
  if (cx == null || cy == null || !payload) return null;

  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill="var(--paylens-main)" stroke="#fff" strokeWidth={2} />
      {payload.isManual && (
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={10} fill="var(--paylens-data-soft)">
          수동
        </text>
      )}
    </g>
  );
}

// F-2-3-1: 총액 추이 라인 차트 — MANUAL로 등록된 달은 점 위에 "수동" 배지를 표시해 OCR 업로드
// 값과 구분한다(화면설계 §3-1, 입력방식 무관 전체 표시).
export function TotalTrendChart({ data }: { data: UtilityBillTotalTrendPoint[] }) {
  const hasData = data.some((point) => point.total > 0);
  if (!hasData) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
        아직 등록된 명세서가 없어요
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
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
        <Tooltip content={<CompactTooltip />} />
        <Line
          type="monotone"
          dataKey="total"
          stroke="var(--paylens-main)"
          strokeWidth={2}
          dot={<TrendDot />}
          activeDot={{ r: 6, fill: "var(--paylens-main)", stroke: "#fff", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
