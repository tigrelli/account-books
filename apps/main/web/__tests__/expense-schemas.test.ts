import { describe, it, expect } from "vitest";
import { expenseSchema, expenseDetailSchema, detailRowSchema } from "../lib/expense-schemas";

const validBase = {
  occurredAt: "2026-07-03",
  paymentMethodId: "00000000-0000-0000-0000-000000000001",
  categoryId: "00000000-0000-0000-0000-000000000002",
  vendorName: "이마트",
};

describe("expenseSchema (직접입력 모드)", () => {
  it("유효한 입력은 통과한다", () => {
    expect(expenseSchema.safeParse({ ...validBase, amount: "15000" }).success).toBe(true);
  });

  it("날짜가 비어있으면 실패한다", () => {
    const result = expenseSchema.safeParse({ ...validBase, occurredAt: "", amount: "1000" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten((i) => i.message).fieldErrors.occurredAt).toContain(
        "날짜를 선택해 주세요"
      );
    }
  });

  it("지출분류가 비어있으면 실패한다", () => {
    const result = expenseSchema.safeParse({ ...validBase, paymentMethodId: "", amount: "1000" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten((i) => i.message).fieldErrors.paymentMethodId).toContain(
        "지출분류를 선택해 주세요"
      );
    }
  });

  // <select>의 placeholder 옵션이 disabled라 아무 것도 고르지 않으면 FormData.get()이 ""가 아닌
  // null을 반환한다(선택 상태 자체가 없음) — 이 케이스에서도 Zod 기본 영문 메시지가 아니라
  // 커스텀 한글 메시지가 나가야 한다(실제 버그: 이 케이스가 비어있는 문자열 케이스와 달리 커버되지 않았었음).
  it("지출분류가 null(select 미선택)이면 한글 메시지로 실패한다", () => {
    const result = expenseSchema.safeParse({ ...validBase, paymentMethodId: null, amount: "1000" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten((i) => i.message).fieldErrors.paymentMethodId).toContain(
        "지출분류를 선택해 주세요"
      );
    }
  });

  it("지출항목이 비어있으면 실패한다", () => {
    const result = expenseSchema.safeParse({ ...validBase, categoryId: "", amount: "1000" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten((i) => i.message).fieldErrors.categoryId).toContain(
        "지출항목을 선택해 주세요"
      );
    }
  });

  it("지출항목이 null(select 미선택)이면 한글 메시지로 실패한다", () => {
    const result = expenseSchema.safeParse({ ...validBase, categoryId: null, amount: "1000" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten((i) => i.message).fieldErrors.categoryId).toContain(
        "지출항목을 선택해 주세요"
      );
    }
  });

  it("지출처가 비어있으면 실패한다", () => {
    const result = expenseSchema.safeParse({ ...validBase, vendorName: "", amount: "1000" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten((i) => i.message).fieldErrors.vendorName).toContain(
        "지출처를 입력해 주세요"
      );
    }
  });

  it("지출처 이름이 50자를 초과하면 실패한다", () => {
    const result = expenseSchema.safeParse({
      ...validBase,
      vendorName: "가".repeat(51),
      amount: "1000",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten((i) => i.message).fieldErrors.vendorName).toContain(
        "지출처 이름이 너무 깁니다"
      );
    }
  });

  it("금액이 0이면 실패한다", () => {
    const result = expenseSchema.safeParse({ ...validBase, amount: "0" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten((i) => i.message).fieldErrors.amount).toContain(
        "금액은 0보다 커야 합니다"
      );
    }
  });

  it("금액이 숫자가 아니면 실패한다", () => {
    const result = expenseSchema.safeParse({ ...validBase, amount: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten((i) => i.message).fieldErrors.amount).toContain(
        "금액을 입력해 주세요"
      );
    }
  });
});

describe("detailRowSchema (상세항목 행)", () => {
  it("유효한 입력은 통과한다", () => {
    expect(
      detailRowSchema.safeParse({ itemText: "양파", quantityText: "1개", amount: "2000" }).success
    ).toBe(true);
  });

  it("품목명이 비어있으면 실패한다", () => {
    const result = detailRowSchema.safeParse({ itemText: "", amount: "2000" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten((i) => i.message).fieldErrors.itemText).toContain(
        "품목명을 입력해 주세요"
      );
    }
  });

  it("상세항목 금액이 0이면 실패한다", () => {
    const result = detailRowSchema.safeParse({ itemText: "양파", amount: "0" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten((i) => i.message).fieldErrors.amount).toContain(
        "상세항목 금액은 0보다 커야 합니다"
      );
    }
  });
});

describe("expenseDetailSchema (상세입력 모드) — 금액 자동계산의 입력 검증", () => {
  it("상세항목이 1개 이상이면 통과하고, 합계는 각 행 금액의 합과 같다", () => {
    const details = [
      { itemText: "양파", amount: "2000" },
      { itemText: "당근", amount: "1500" },
    ];
    const result = expenseDetailSchema.safeParse({ ...validBase, details });
    expect(result.success).toBe(true);
    if (result.success) {
      const total = result.data.details.reduce((sum, d) => sum + d.amount, 0);
      expect(total).toBe(3500);
    }
  });

  it("상세항목이 0개면 실패한다", () => {
    const result = expenseDetailSchema.safeParse({ ...validBase, details: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten((i) => i.message).fieldErrors.details).toContain(
        "상세항목을 1개 이상 입력해 주세요"
      );
    }
  });
});
