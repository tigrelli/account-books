import { z } from "zod";

const displayNameField = z.string().min(1, "이름을 입력해 주세요").max(50, "이름이 너무 깁니다");

export const displayNameSchema = z.object({
  displayName: displayNameField,
});

// 2026-07-03 PM 결정: "카드 별칭"+"카드사" 두 칸을 "카드사명" 한 칸으로 통합 — displayName이 곧 카드사명.
// card_issuer 입력 자체를 폼에서 제거(컬럼은 삭제하지 않고 항상 null로 저장, actions.ts 참고).
export const cardSchema = z.object({
  displayName: displayNameField,
  // zod v4의 z.enum() 기본 에러 메시지가 영문이라 refine으로 한글 메시지 지정
  cardKind: z.string().refine((v) => v === "CHECK" || v === "CREDIT", "카드 종류를 선택해 주세요"),
});
