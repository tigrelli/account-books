import { z } from "zod";

export const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

// 카테고리별 예산 입력 필드의 name 접두사. actions.ts("use server" 파일)는 async 함수만
// export할 수 있어 이 상수를 여기(lib)에 두고 actions.ts/BudgetSection.tsx 양쪽에서 가져다 쓴다.
export const CATEGORY_FIELD_PREFIX = "categoryAmount:";

// 전체/카테고리별 예산 입력 필드 공용 스키마 — 빈 값/"0"은 "미설정(예산 없음)"으로
// 취급하므로 여기서는 형식(숫자만)만 검증하고, 0 초과 여부는 액션에서 의미에 맞게 처리한다.
export const budgetAmountSchema = z.string().trim().regex(/^\d*$/, "숫자만 입력해 주세요");
