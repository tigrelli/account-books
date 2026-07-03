import { z } from "zod";

// 2026-07-03 PM 결정: 지출처는 여러 카테고리의 지출이 섞일 수 있어(예: GS슈퍼에서 식료품+의류) 특정
// 카테고리에 고정 매칭하지 않음 — defaultCategoryId 필드 자체를 제거(DB 컬럼은 유지, 항상 null로 저장).
export const vendorSchema = z.object({
  name: z.string().min(1, "이름을 입력해 주세요").max(50, "이름이 너무 깁니다"),
});
