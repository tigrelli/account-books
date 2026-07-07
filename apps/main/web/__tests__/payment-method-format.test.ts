import { describe, it, expect } from "vitest";
import { formatPaymentMethodLabel, paymentMethodLabelText } from "../lib/payment-method-format";

describe("paymentMethodLabelText", () => {
  it("지갑(현금)은 표시명/현금을 반환한다", () => {
    expect(
      paymentMethodLabelText({
        display_name: "지갑(현금)",
        type: "CASH",
        card_kind: null,
        subtype: "CASH_SPEND",
      })
    ).toBe("지갑(현금)/현금");
  });

  it("은행 계좌(subtype=AUTO_TRANSFER)는 표시명/계좌를 반환한다", () => {
    expect(
      paymentMethodLabelText({
        display_name: "우리은행",
        type: "CASH",
        card_kind: null,
        subtype: "AUTO_TRANSFER",
      })
    ).toBe("우리은행/계좌");
  });

  it("아이콘 없이 표시명/신용만 반환한다", () => {
    expect(
      paymentMethodLabelText({
        display_name: "신한카드",
        type: "CARD",
        card_kind: "CREDIT",
        subtype: null,
      })
    ).toBe("신한카드/신용");
  });
});

describe("formatPaymentMethodLabel", () => {
  it("현금(지갑) — 💵 표시명/현금", () => {
    expect(
      formatPaymentMethodLabel({
        display_name: "지갑(현금)",
        type: "CASH",
        card_kind: null,
        subtype: "CASH_SPEND",
      })
    ).toBe("💵 지갑(현금)/현금");
  });

  it("현금(계좌) — 💵 표시명/계좌", () => {
    expect(
      formatPaymentMethodLabel({
        display_name: "우리은행",
        type: "CASH",
        card_kind: null,
        subtype: "AUTO_TRANSFER",
      })
    ).toBe("💵 우리은행/계좌");
  });

  it("체크카드 — 💳 표시명/체크", () => {
    expect(
      formatPaymentMethodLabel({
        display_name: "우리카드",
        type: "CARD",
        card_kind: "CHECK",
        subtype: null,
      })
    ).toBe("💳 우리카드/체크");
  });

  it("신용카드 — 💳 표시명/신용", () => {
    expect(
      formatPaymentMethodLabel({
        display_name: "신한카드",
        type: "CARD",
        card_kind: "CREDIT",
        subtype: null,
      })
    ).toBe("💳 신한카드/신용");
  });
});
