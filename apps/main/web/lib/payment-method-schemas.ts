import { z } from "zod";

const displayNameField = z.string().min(1, "이름을 입력해 주세요").max(50, "이름이 너무 깁니다");

export const displayNameSchema = z.object({
  displayName: displayNameField,
});

export const cardSchema = z.object({
  displayName: displayNameField,
  cardIssuer: z.string().min(1, "카드사를 입력해 주세요").max(30, "카드사명이 너무 깁니다"),
  // zod v4의 z.enum() 기본 에러 메시지가 영문이라 refine으로 한글 메시지 지정
  cardKind: z.string().refine((v) => v === "CHECK" || v === "CREDIT", "카드 종류를 선택해 주세요"),
});
