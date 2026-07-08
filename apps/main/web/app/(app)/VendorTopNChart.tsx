"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@account-books/utils";
import type { VendorTopNItem } from "@/lib/dashboard-queries";

function CompactTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: VendorTopNItem }[];
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 shadow-sm">
      <p className="text-xs text-[var(--color-text-secondary)]">{item.vendorName}</p>
      <p className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
        {formatCurrency(item.total)}
      </p>
    </div>
  );
}

// F-3-1-2: 지출처 Top N — 단일 시리즈 크기 비교(magnitude)라 dataviz 스킬 기준대로 카테고리컬
// 팔레트 대신 단일 색(월별추이 F-1-8-2와 동일한 --paylens-main) 가로 막대 사용, 범례 없음(제목이
// 대신함). 지출처명이 길 수 있어 세로 막대 대신 가로 막대로 이름을 온전히 보여준다. 막대 끝에
// 금액을 직접 라벨링(dataviz 스킬: "Bars → value at the tip").
export function VendorTopNChart({ data }: { data: VendorTopNItem[] }) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
        아직 지출 내역이 없어요
      </p>
    );
  }

  const chartHeight = Math.max(data.length * 36, 120);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 56, left: 0, bottom: 0 }}
        barCategoryGap={8}
      >
        <CartesianGrid horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="vendorName"
          tickLine={false}
          axisLine={false}
          width={96}
          tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
        />
        <Tooltip content={<CompactTooltip />} cursor={{ fill: "var(--paylens-bg)" }} />
        <Bar
          dataKey="total"
          fill="var(--paylens-main)"
          radius={[0, 4, 4, 0]}
          maxBarSize={24}
          label={{
            position: "right",
            fill: "var(--color-text-primary)",
            fontSize: 12,
            formatter: (value: string | number | boolean | null | undefined) =>
              formatCurrency(Number(value ?? 0)),
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
