import type { Database } from "@account-books/types";

type PaymentMethod = Database["public"]["Tables"]["payment_method"]["Row"];

const cardKindShortLabel: Record<string, string> = {
  CHECK: "체크",
  CREDIT: "신용",
};

// 지출항목처럼 지출분류도 아이콘을 앞에 붙여 한눈에 구분(2026-07-03 PM 결정) — 현금/카드는 사용자가 고르는 게
// 아니라 타입에 따라 고정 아이콘을 붙인다(카테고리 icon 컬럼과 달리 사용자 지정 아이콘 아님).
const typeIcon: Record<string, string> = {
  CASH: "💵",
  CARD: "💳",
};

// "표시명/구분"(예: 우리은행/현금, 신한카드/신용) — 아이콘 없이 텍스트만. select 옵션처럼 아이콘까지 필요하면
// formatPaymentMethodLabel을, 목록 화면처럼 아이콘을 별도 컬러 SVG로 그려야 하면 이 함수를 직접 사용.
export function paymentMethodLabelText(
  paymentMethod: Pick<PaymentMethod, "display_name" | "type" | "card_kind">
): string {
  const kindLabel =
    paymentMethod.type === "CARD"
      ? (cardKindShortLabel[paymentMethod.card_kind ?? ""] ?? "카드")
      : "현금";
  return `${paymentMethod.display_name}/${kindLabel}`;
}

// 지출 입력 폼/지출 내역 필터의 <select><option> 등 순수 텍스트만 가능한 곳에서 사용 — "아이콘 표시명/구분"
// (예: 💵 우리은행/현금, 💳 신한카드/신용). option 안에서는 HTML/CSS를 못 쓰므로 컬러 이모지를 그대로 사용
// (체크/신용 색상 구분은 불가능 — 색 구분이 필요한 목록 화면은 PaymentMethodTag 컴포넌트로 별도 렌더링).
export function formatPaymentMethodLabel(
  paymentMethod: Pick<PaymentMethod, "display_name" | "type" | "card_kind">
): string {
  const icon = typeIcon[paymentMethod.type] ?? "";
  return `${icon} ${paymentMethodLabelText(paymentMethod)}`;
}
