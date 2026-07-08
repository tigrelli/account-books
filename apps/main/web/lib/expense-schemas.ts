import { z } from "zod";

// <select>의 플레이스홀더 옵션(예: "지출분류 선택")은 disabled라 아무 것도 고르지 않으면 브라우저가
// 아예 선택 상태를 만들지 않아(selectedIndex -1) FormData에 필드 자체가 안 실리고 formData.get()이
// null을 반환한다 — z.string()이 이 null을 타입 에러로 먼저 걸러버려 아래 min() 커스텀 메시지 대신
// zod 기본 영문 메시지("Invalid input: expected string, received null")가 나가는 문제를 방지하기
// 위해 null/undefined를 빈 문자열로 정규화한 뒤 검증한다.
const requiredSelectField = (message: string) =>
  z.preprocess((value) => value ?? "", z.string().min(1, message));

const commonExpenseFields = {
  occurredAt: z.string().min(1, "날짜를 선택해 주세요"),
  paymentMethodId: requiredSelectField("지출분류를 선택해 주세요"),
  categoryId: requiredSelectField("지출항목을 선택해 주세요"),
  vendorName: z
    .string()
    .trim()
    .min(1, "지출처를 입력해 주세요")
    .max(50, "지출처 이름이 너무 깁니다"),
  // 숫자/특수문자 포함 자유 텍스트 — 형식 제한 없이 길이만 검증(PM 요청, 2026-07-07).
  memo: z.string().max(1000, "비고는 1000자 이내로 입력해 주세요").optional(),
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
