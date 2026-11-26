"use client";

import { useState } from "react";

export interface VendorOption {
  id: string;
  name: string;
}

// [F-2-4-6] 지출 입력 폼(ExpenseEntryForm)에서 관리비 업로드 화면과 함께 쓰려고 공통 컴포넌트로 분리.
// 지출처는 사전 등록이 필수가 아님 — 기존 항목 자동완성 선택 또는 자유 입력한 새 이름 그대로 제출.
// 실제 신규 등록 여부는 서버 액션(find-or-create)에서 결정되므로 여기서는 확인 절차 없음.
export function VendorCombobox({
  vendors,
  value,
  onChange,
  inputClassName,
  placeholder = "지출처 입력 (예: 이마트)",
}: {
  vendors: VendorOption[];
  value: string;
  onChange: (v: string) => void;
  inputClassName: string;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const matches =
    value.trim().length === 0
      ? []
      : vendors
          .filter((v) => v.name.toLowerCase().includes(value.trim().toLowerCase()))
          .slice(0, 8);

  return (
    <div className="relative">
      <input
        name="vendorName"
        type="text"
        autoComplete="off"
        lang="ko"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className={inputClassName}
      />
      {isOpen && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
          {matches.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(v.name);
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
