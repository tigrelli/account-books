import { z } from "zod";

// 등록 시 제공하는 기본 아이콘 프리셋 — 자유 입력 대신 이 중에서 선택
export const CATEGORY_ICON_PRESETS = [
  "🛒",
  "👕",
  "🏠",
  "🛡️",
  "📱",
  "🏢",
  "🤝",
  "💸",
  "🚗",
  "🏥",
  "📦",
  "🎬",
  "🎮",
  "📚",
  "✈️",
  "🐾",
] as const;

export const categorySchema = z.object({
  name: z.string().min(1, "이름을 입력해 주세요").max(30, "이름이 너무 깁니다"),
  icon: z.string().max(10, "아이콘은 짧은 이모지 1개만 입력해 주세요").optional(),
});
