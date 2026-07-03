import { z } from "zod";

export const aliasSchema = z.object({
  alias: z.string().trim().min(1, "별칭을 입력해 주세요").max(30, "별칭이 너무 깁니다"),
});
