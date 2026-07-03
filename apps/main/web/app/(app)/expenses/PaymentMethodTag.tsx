import { Banknote, CreditCard } from "lucide-react";
import type { Database } from "@account-books/types";
import { paymentMethodLabelText } from "@/lib/payment-method-format";

type PaymentMethod = Database["public"]["Tables"]["payment_method"]["Row"];

// select의 <option>은 텍스트만 가능해 컬러 이모지(💳)로도 체크/신용 색상을 구분할 수 없음(색상 자체가 고정) —
// JSX를 그릴 수 있는 목록 화면 전용으로, lucide 아이콘 색을 현금/체크/신용 다르게 입혀 구분(2026-07-03 PM 결정).
// 색상 토큰은 --paylens-cash/--paylens-check/--paylens-credit 3개 전용 변수 사용 — 처음엔 체크에
// --paylens-action(버튼/링크와 공용)을 재사용했으나 현금과 색이 비슷해 구분이 어렵다는 피드백으로 분리.
export function PaymentMethodTag({
  paymentMethod,
}: {
  paymentMethod: Pick<PaymentMethod, "display_name" | "type" | "card_kind">;
}) {
  const Icon = paymentMethod.type === "CARD" ? CreditCard : Banknote;
  const colorStyle =
    paymentMethod.type === "CARD"
      ? {
          color:
            paymentMethod.card_kind === "CREDIT" ? "var(--paylens-credit)" : "var(--paylens-check)",
        }
      : { color: "var(--paylens-cash)" };

  return (
    <span className="inline-flex items-center gap-1">
      <Icon size={14} style={colorStyle} aria-hidden="true" />
      {paymentMethodLabelText(paymentMethod)}
    </span>
  );
}
