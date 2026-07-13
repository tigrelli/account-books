import { GoogleVisionProvider } from "./google-vision-provider";
import type { OCRProvider } from "./types";

export type { OCRProvider, OCRResult, OCRTextBlock } from "./types";
export { GoogleVisionProvider } from "./google-vision-provider";

// 엔진 교체/병행 시 이 팩토리만 바꾸면 된다 — 호출부(S-2-8 등)는 OCRProvider 인터페이스만 안다.
export function createOCRProvider(): OCRProvider {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_VISION_API_KEY가 설정되지 않았습니다");
  }
  return new GoogleVisionProvider(apiKey);
}
