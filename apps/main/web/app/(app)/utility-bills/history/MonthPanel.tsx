import type { UtilityBillHistoryPanel } from "@/lib/utility-bill-history-queries";
import { UtilityBillItemBreakdown } from "../_components/UtilityBillItemBreakdown";

function formatMonthLabel(period: string): string {
  return `${Number(period.split("-")[1])}월`;
}

// [F-2-4-4] 이력 화면의 월별 카드 — 3가지 상태: ①업로드로 등록(원본 구획별 내역) ②수동
// 등록(F-2-4-3 훅, 항목별 원본이 없어 총액만) ③등록 자체가 없음(안내 문구만).
export function MonthPanel({
  period,
  panel,
  highlight,
}: {
  period: string;
  panel: UtilityBillHistoryPanel | undefined;
  highlight: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 shadow-sm ${
        highlight ? "ring-2 ring-[var(--paylens-action)]" : ""
      }`}
    >
      <p className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
        {period} · {formatMonthLabel(period)}
      </p>

      {!panel && (
        <p className="text-sm text-[var(--color-text-secondary)]">등록된 데이터가 없습니다</p>
      )}

      {panel?.source === "MANUAL" && (
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">수동 등록(항목별 내역 없음)</p>
          <p className="mt-1 font-mono text-lg font-bold text-[var(--color-text-primary)]">
            {panel.total.toLocaleString("ko-KR")}원
          </p>
        </div>
      )}

      {panel?.source === "UPLOAD" && (
        <UtilityBillItemBreakdown items={panel.items} total={panel.total} />
      )}
    </div>
  );
}
