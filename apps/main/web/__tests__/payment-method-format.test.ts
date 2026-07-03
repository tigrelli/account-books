import { describe, it, expect } from "vitest";
import { formatPaymentMethodLabel, paymentMethodLabelText } from "../lib/payment-method-format";

describe("paymentMethodLabelText", () => {
  it("아이콘 없이 표시명/현금만 반환한다", () => {
    expect(
      paymentMethodLabelText({ display_name: "우리은행", type: "CASH", card_kind: null })
    ).toBe("우리은행/현금");
  });

  it("아이콘 없이 표시명/신용만 반환한다", () => {
    expect(
      paymentMethodLabelText({ display_name: "신한카드", type: "CARD", card_kind: "CREDIT" })
    ).toBe("신한카드/신용");
  });
});

describe("formatPaymentMethodLabel", () => {
  it("현금(지갑) — 💵 표시명/현금", () => {
    expect(
      formatPaymentMethodLabel({ display_name: "지갑(현금)", type: "CASH", card_kind: null })
    ).toBe("💵 지갑(현금)/현금");
  });

  it("현금(계좌) — 💵 표시명/현금", () => {
    expect(
      formatPaymentMethodLabel({ display_name: "우리은행", type: "CASH", card_kind: null })
    ).toBe("💵 우리은행/현금");
  });

  it("체크카드 — 💳 표시명/체크", () => {
    expect(
      formatPaymentMethodLabel({ display_name: "우리카드", type: "CARD", card_kind: "CHECK" })
    ).toBe("💳 우리카드/체크");
  });

  it("신용카드 — 💳 표시명/신용", () => {
    expect(
      formatPaymentMethodLabel({ display_name: "신한카드", type: "CARD", card_kind: "CREDIT" })
    ).toBe("💳 신한카드/신용");
  });
});
