import { z } from "zod";

// 관리비 명세서 업로드 파일 확장자 — OCR 벤더 선정 전이라 우선 이미지+PDF로 제한(§8 TBD, S-2-7 이후 재검토).
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"] as const;

export const createUploadUrlSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM 형식이어야 합니다"),
  ext: z.enum(ALLOWED_EXTENSIONS, { message: "지원하지 않는 파일 형식입니다" }),
});

export type CreateUploadUrlInput = z.infer<typeof createUploadUrlSchema>;
