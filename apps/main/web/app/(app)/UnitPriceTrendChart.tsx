"use client";

import { useState } from "react";
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

function optionLabel(option: Pick<UnitPriceOption, "itemName" | "unitName">): string {
  return `${option.itemName} (${option.unitName})`;
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

// F-3-1-4: 품목×단위 평균 단가 추이 — 구조화된 수량(quantity_value+unit_id)이 있는 조합만 고를 수
// 있다(item_unit_stats, S-3-3이 애초에 그 조건만 집계). 선택은 URL 쿼리(?unitItem=)로 관리해
// 새로고침/공유해도 유지되도록 함(예산/캘린더의 ?period= 패턴과 동일한 방식).
//
// 2026-07-09 PM 요청: 조합이 늘어날수록 <select>가 스크롤만 계속 길어지는 문제 — ExpenseEntryForm의
// VendorCombobox/ItemCombobox와 동일한 입력창+필터 드롭다운 패턴으로 교체(검색 대상은 품목명만,
// PM 확인). 옆의 "검색" 버튼은 드롭다운에서 직접 고르지 않아도, 지금 필터된 목록의 1순위(원래도
// 구매량 많은 순 정렬이라 자연스러운 기본값)를 바로 선택한다.
//
// 2026-07-09 PM 재요청: 처음 진입 시 특정 조합을 자동으로 골라 바로 그래프를 보여주던 것을
// 제거 — 검색으로 실제 선택하기 전(selectedKey==="")에는 데이터를 아예 가져오지 않고(page.tsx의
// selectedUnitOption도 더 이상 options[0] 폴백 없음) 입력창은 빈 채로 안내 placeholder만 표시.
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
  const selectedOption = options.find((option) => optionKey(option) === selectedKey);

  const [query, setQuery] = useState(selectedOption ? optionLabel(selectedOption) : "");
  // 선택된 조합의 라벨("양파 (kg)")을 그대로 입력창 기본값으로 보여주다 보니, 그 값 자체로
  // itemName만 필터링하면 "(kg)" 부분 때문에 자기 자신도 안 걸리는 문제가 생긴다 — 사용자가
  // 실제로 타이핑을 시작했는지(isDirty)를 따로 추적해, 타이핑 전에는 전체 목록을 보여준다.
  const [isDirty, setIsDirty] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // 다른 조합을 선택해 URL 이동이 실제로 반영되면(selectedKey 갱신) 입력창 표시도 재동기화 —
  // useEffect 대신 렌더 중 이전 값과 비교하는 패턴(CLAUDE.md 컨벤션, ExpenseEntryForm의 prevState와
  // 동일한 이유: 캐스케이드 렌더링 경고 회피).
  const [prevSelectedKey, setPrevSelectedKey] = useState(selectedKey);
  if (selectedKey !== prevSelectedKey) {
    setPrevSelectedKey(selectedKey);
    setQuery(selectedOption ? optionLabel(selectedOption) : "");
    setIsDirty(false);
  }

  if (options.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
        구조화된 수량(예: &ldquo;2개&rdquo;, &ldquo;1kg&rdquo;)으로 입력된 상세항목이 아직 없어요
      </p>
    );
  }

  const trimmedQuery = query.trim().toLowerCase();
  const matches =
    !isDirty || trimmedQuery.length === 0
      ? options
      : options.filter((option) => option.itemName.toLowerCase().includes(trimmedQuery));

  function selectOption(option: UnitPriceOption) {
    setIsOpen(false);
    setQuery(optionLabel(option));
    setIsDirty(false);
    const params = new URLSearchParams({ period, unitItem: optionKey(option) });
    router.push(`/?${params.toString()}`, { scroll: false });
  }

  function handleSearch() {
    const top = matches[0];
    if (top) selectOption(top);
  }

  const hasAnyData = trend.some((point) => point.avgUnitPrice !== null);

  return (
    <div>
      <div className="relative mb-3 flex max-w-sm gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsDirty(true);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="항목을 검색하세요"
            className="h-9 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm outline-none focus:border-[var(--paylens-action)]"
          />
          {isOpen && matches.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
              {matches.map((option) => (
                <li key={optionKey(option)}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectOption(option);
                    }}
                    className="block w-full px-3.5 py-2 text-left text-sm hover:bg-[var(--paylens-bg)]"
                  >
                    {optionLabel(option)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={matches.length === 0}
          className="h-9 shrink-0 rounded-lg border border-[var(--paylens-action)] px-3 text-sm font-medium text-[var(--paylens-action)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          검색
        </button>
      </div>

      {selectedKey === "" ? (
        <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
          검색해서 확인할 품목을 선택하세요
        </p>
      ) : hasAnyData ? (
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
