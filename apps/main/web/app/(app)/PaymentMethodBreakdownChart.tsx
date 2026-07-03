import { formatCurrency } from "@account-books/utils";
import { PaymentMethodTag } from "@/app/(app)/expenses/PaymentMethodTag";
import type { PaymentMethodBreakdownResult } from "@/lib/dashboard-queries";

// F-3-1-1: 이번달 지출분류별(현금/카드 대분류 + 카드는 카드사명별) 막대 —
// 이미 앱 전역에서 학습된 결제수단 색상(--paylens-cash/check/credit, PaymentMethodTag와 동일)을 그대로 재사용해
// 세그먼트 색만 보고도 현금/체크/신용 구간이 구분되도록 한다(새 카테고리 팔레트를 따로 만들지 않음).
// 대분류(현금/카드) 총액은 막대 위 브래킷 라벨로, 개별 결제수단(분류 데이터) 수치는 막대 세그먼트+아래 목록으로 —
// 2조각 파이는 dataviz 스킬 안티패턴(비교값 2개는 파이 대신 숫자로)이라 브래킷+누적막대 하나로 대체.
function segmentColor(item: { type: string; cardKind: string | null }): string {
  if (item.type === "CASH") return "var(--paylens-cash)";
  return item.cardKind === "CREDIT" ? "var(--paylens-credit)" : "var(--paylens-check)";
}

function BracketLabel({
  label,
  total,
  grandTotal,
}: {
  label: string;
  total: number;
  grandTotal: number;
}) {
  if (total <= 0) return null;
  const percent = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;

  return (
    <div
      style={{ flexGrow: total, flexBasis: 0 }}
      className="min-w-0 border-b-2 border-[#cbd5e1] pb-1.5 text-center"
    >
      <p className="truncate text-xs text-[var(--color-text-secondary)]">
        {label} {formatCurrency(total)} · {percent}%
      </p>
    </div>
  );
}

export function PaymentMethodBreakdownChart({ data }: { data: PaymentMethodBreakdownResult }) {
  const { items, cashTotal, cardTotal } = data;
  const grandTotal = cashTotal + cardTotal;

  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
        아직 지출 내역이 없어요
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex">
          <BracketLabel label="현금" total={cashTotal} grandTotal={grandTotal} />
          <BracketLabel label="카드" total={cardTotal} grandTotal={grandTotal} />
        </div>
        <div className="mt-1.5 flex h-8 w-full gap-[2px] overflow-hidden rounded-full bg-white">
          {items.map((item, i) => (
            <div
              key={item.paymentMethodId}
              title={`${item.displayName} · ${formatCurrency(item.total)}`}
              style={{ flexGrow: item.total, flexBasis: 0, backgroundColor: segmentColor(item) }}
              className={
                i === 0 ? "rounded-l-full" : i === items.length - 1 ? "rounded-r-full" : ""
              }
            />
          ))}
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const percent = grandTotal > 0 ? Math.round((item.total / grandTotal) * 100) : 0;
          return (
            <li key={item.paymentMethodId} className="flex items-center gap-2 text-sm">
              <PaymentMethodTag
                paymentMethod={{
                  display_name: item.displayName,
                  type: item.type,
                  card_kind: item.cardKind,
                }}
              />
              <span className="flex-1" />
              <span className="font-mono text-[var(--color-text-secondary)]">
                {formatCurrency(item.total)} · {percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
