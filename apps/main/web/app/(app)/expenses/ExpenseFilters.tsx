"use client";

import { useState } from "react";
import Link from "next/link";
import type { Database } from "@account-books/types";
import { formatPaymentMethodLabel } from "@/lib/payment-method-format";

type Category = Database["public"]["Tables"]["category"]["Row"];
type PaymentMethod = Database["public"]["Tables"]["payment_method"]["Row"];
type Vendor = Database["public"]["Tables"]["vendor"]["Row"];

export type ExpenseFilterValues = {
  from?: string | undefined;
  to?: string | undefined;
  categoryId?: string | undefined;
  paymentMethodId?: string | undefined;
  vendorId?: string | undefined;
};

const selectClassName =
  "h-9 w-full rounded-lg border border-[#e2e8f0] bg-white px-2.5 text-sm outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15";

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
      {children}
    </label>
  );
}

// 지출처는 계속 늘어나는 마스터 데이터라 <select>로 두면 옵션이 끝없이 길어짐 — 검색 자동완성으로 교체
// (ExpenseEntryForm의 VendorCombobox와 유사하나, 이쪽은 이름을 새로 만들지 않고 기존 지출처 중 하나를
// 반드시 선택해야 필터에 반영됨 — 목록에서 고르기 전까지는 hidden input이 비어있어 필터 미적용 상태).
function VendorFilterCombobox({
  vendors,
  initialVendorId,
}: {
  vendors: Vendor[];
  initialVendorId: string;
}) {
  const initialVendor = vendors.find((v) => v.id === initialVendorId);
  const [query, setQuery] = useState(initialVendor?.name ?? "");
  const [selectedId, setSelectedId] = useState(initialVendorId);
  const [isOpen, setIsOpen] = useState(false);

  // 필터용이라 8개로 잘라 후보를 숨기지 않고, 검색어에 일치하는 지출처를 모두 보여줌(목록 자체는 스크롤 처리).
  const matches =
    query.trim().length === 0
      ? []
      : vendors.filter((v) => v.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="relative">
      <input
        type="text"
        autoComplete="off"
        placeholder="지출처 검색 후 선택"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedId("");
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className={selectClassName}
      />
      <input type="hidden" name="vendorId" value={selectedId} />
      {isOpen && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
          {matches.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery(v.name);
                  setSelectedId(v.id);
                  setIsOpen(false);
                }}
                className="block w-full px-3.5 py-2 text-left text-sm hover:bg-[var(--paylens-bg)]"
              >
                {v.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ExpenseFilters({
  categories,
  paymentMethods,
  vendors,
  values,
}: {
  categories: Category[];
  paymentMethods: PaymentMethod[];
  vendors: Vendor[];
  values: ExpenseFilterValues;
}) {
  const hasFilter = Object.values(values).some(Boolean);

  return (
    <form method="get" action="/expenses" className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FilterLabel>시작일</FilterLabel>
          <input
            type="date"
            name="from"
            defaultValue={values.from ?? ""}
            className={selectClassName}
          />
        </div>
        <div>
          <FilterLabel>종료일</FilterLabel>
          <input type="date" name="to" defaultValue={values.to ?? ""} className={selectClassName} />
        </div>
        <div>
          <FilterLabel>지출분류</FilterLabel>
          <select
            name="paymentMethodId"
            defaultValue={values.paymentMethodId ?? ""}
            className={selectClassName}
          >
            <option value="">전체</option>
            {/* 2026-07-03 PM 결정: "표시명/구분" 표기로 현금/카드 구분이 드러나므로 대분류(optgroup) 없이 등록순으로 나열. */}
            {paymentMethods.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPaymentMethodLabel(p)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FilterLabel>지출항목</FilterLabel>
          <select
            name="categoryId"
            defaultValue={values.categoryId ?? ""}
            className={selectClassName}
          >
            <option value="">전체</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <FilterLabel>지출처</FilterLabel>
          <VendorFilterCombobox vendors={vendors} initialVendorId={values.vendorId ?? ""} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          className="h-9 flex-1 rounded-lg bg-[var(--paylens-action)] text-sm font-semibold text-white"
        >
          필터 적용
        </button>
        {hasFilter && (
          <Link
            href="/expenses"
            prefetch={false}
            className="text-sm font-medium text-[var(--color-text-secondary)] hover:underline"
          >
            초기화
          </Link>
        )}
      </div>
    </form>
  );
}
