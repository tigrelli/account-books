import { z } from "zod";

// F-3-1-5: group_key는 자유 텍스트(예: GROUP_GREEN_ONION) — 같은 값이면 같은 그룹으로 묶인다.
export const synonymTermSchema = z.object({
  groupKey: z.string().trim().min(1, "그룹 키를 입력해 주세요").max(50, "그룹 키가 너무 깁니다"),
  term: z.string().trim().min(1, "단어를 입력해 주세요").max(50, "단어가 너무 깁니다"),
});
