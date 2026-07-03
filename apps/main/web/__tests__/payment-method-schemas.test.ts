import { describe, it, expect } from "vitest";
import { displayNameSchema, cardSchema } from "../lib/payment-method-schemas";

describe("displayNameSchema", () => {
  it("유효한 이름은 통과한다", () => {
    expect(displayNameSchema.safeParse({ displayName: "신한은행 통장" }).success).toBe(true);
  });

  it("이름이 비어있으면 실패한다", () => {
    const result = displayNameSchema.safeParse({ displayName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.displayName).toContain("이름을 입력해 주세요");
    }
  });

  it("이름이 50자를 초과하면 실패한다", () => {
    const result = displayNameSchema.safeParse({ displayName: "a".repeat(51) });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.displayName).toContain("이름이 너무 깁니다");
    }
  });
});

describe("cardSchema", () => {
  const valid = { displayName: "국민카드", cardKind: "CHECK" };

  it("유효한 입력은 통과한다", () => {
    expect(cardSchema.safeParse(valid).success).toBe(true);
  });

  it("CREDIT 카드종류도 통과한다", () => {
    expect(cardSchema.safeParse({ ...valid, cardKind: "CREDIT" }).success).toBe(true);
  });

  it("카드사명이 비어있으면 실패한다", () => {
    const result = cardSchema.safeParse({ ...valid, displayName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.displayName).toContain("이름을 입력해 주세요");
    }
  });

  it("카드종류가 CHECK/CREDIT이 아니면 실패한다", () => {
    const result = cardSchema.safeParse({ ...valid, cardKind: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.cardKind).toContain("카드 종류를 선택해 주세요");
    }
  });

  it("카드종류가 임의의 다른 문자열이면 실패한다", () => {
    const result = cardSchema.safeParse({ ...valid, cardKind: "DEBIT" });
    expect(result.success).toBe(false);
  });
});
