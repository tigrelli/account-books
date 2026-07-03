import { z } from "zod";

const commonExpenseFields = {
  occurredAt: z.string().min(1, "날짜를 선택해 주세요"),
  paymentMethodId: z.string().min(1, "지출분류를 선택해 주세요"),
  categoryId: z.string().min(1, "지출항목을 선택해 주세요"),
  vendorName: z
    .string()
    .trim()
    .min(1, "지출처를 입력해 주세요")
    .max(50, "지출처 이름이 너무 깁니다"),
};

export const expenseSchema = z.object({
  ...commonExpenseFields,
  amount: z.coerce.number({ error: "금액을 입력해 주세요" }).positive("금액은 0보다 커야 합니다"),
});

// 상세입력 모드(F-1-5-4~11) — itemId는 자동완성으로 기존 Item에 이미 연결된 경우만 채워짐(선택).
// quantityText는 선택 입력이라 빈 문자열도 허용 — 구조화(숫자+단위 분리)는 서버 액션에서 parseQuantityText로 처리.
export const detailRowSchema = z.object({
  itemText: z.string().trim().min(1, "품목명을 입력해 주세요").max(50, "품목명이 너무 깁니다"),
  itemId: z.string().optional(),
  quantityText: z.string().optional(),
  amount: z.coerce
    .number({ error: "상세항목 금액을 입력해 주세요" })
    .positive("상세항목 금액은 0보다 커야 합니다"),
});

export const expenseDetailSchema = z.object({
  ...commonExpenseFields,
  details: z.array(detailRowSchema).min(1, "상세항목을 1개 이상 입력해 주세요"),
});
