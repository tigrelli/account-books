"use client";

import { useState } from "react";
import { SuccessDialog } from "../../_components/SuccessDialog";
import type { UtilityBillTotalMismatch } from "@/lib/utility-bill-stats-queries";

// [F-2-4-2] 화면설계 §3-2 "상단 알림 아이콘(있을 때)" — 지정 항목 합계와 실제 등록 금액이
// 다를 때만 렌더링(호출 쪽에서 mismatch가 null이면 아예 렌더하지 않음).
export function TotalMismatchAlert({ mismatch }: { mismatch: UtilityBillTotalMismatch }) {
  const [open, setOpen] = useState(false);
  const diff = Math.abs(mismatch.officialTotal - mismatch.itemsTotal);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--paylens-accent)]/10 px-2.5 py-1 text-sm font-medium text-[var(--paylens-accent)]"
      >
        ⚠️ 총액 불일치
      </button>
      <SuccessDialog
        open={open}
        onOpenChange={setOpen}
        message={`지정 항목 합계(${mismatch.itemsTotal.toLocaleString("ko-KR")}원)와 실제 등록 금액(${mismatch.officialTotal.toLocaleString("ko-KR")}원)이 ${diff.toLocaleString("ko-KR")}원 다릅니다. 명세서에 지정하지 않은 항목이 있거나, 지출 내역에서 금액을 직접 수정하신 경우 발생할 수 있습니다.`}
      />
    </>
  );
}
