"use client";

import { useState } from "react";

// [F-2-4-1 개선, 2026-07-19 PM 요청] 안내 문구를 항상 노출하지 않고, 타이틀 옆 정보 아이콘을
// 클릭하면 펼치고 다시 클릭하면 접는다 — 캘린더 지출 상세보기 팝업(EditExpenseDialog)과 동일한
// 인터랙션.
export function ExpenseEditHeader({ isUtilityBill }: { isUtilityBill: boolean }) {
  const [showUtilityBillInfo, setShowUtilityBillInfo] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">지출 수정</h1>
        {isUtilityBill && (
          <button
            type="button"
            onClick={() => setShowUtilityBillInfo((v) => !v)}
            aria-label="관리비 명세서 안내"
            aria-expanded={showUtilityBillInfo}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--paylens-action)]/10 text-xs text-[var(--paylens-action)]"
          >
            ℹ️
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        지출 내역을 수정하거나 삭제하세요
      </p>
      {isUtilityBill && showUtilityBillInfo && (
        <div className="mt-3 rounded-lg border border-[var(--paylens-action)] bg-[var(--paylens-action)]/5 p-3 text-sm text-[var(--color-text-primary)]">
          이 지출은 관리비 명세서로 등록되었습니다. 금액을 수정해도 항목별 통계는 원본 그대로
          유지됩니다.
        </div>
      )}
    </div>
  );
}
