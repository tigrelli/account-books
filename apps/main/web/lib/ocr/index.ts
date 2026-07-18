import { GoogleVisionProvider } from "./google-vision-provider";
import { FixtureOCRProvider } from "./fixture-provider";
import type { OCRProvider } from "./types";

export type { OCRProvider, OCRResult, OCRTextBlock } from "./types";
export { GoogleVisionProvider } from "./google-vision-provider";
export { FixtureOCRProvider } from "./fixture-provider";

// 엔진 교체/병행 시 이 팩토리만 바꾸면 된다 — 호출부(S-2-8 등)는 OCRProvider 인터페이스만 안다.
// [T-2-2] OCR_PROVIDER=fixture일 때만 결정적 테스트 provider를 쓴다 — 유료 Vision API를
// 호출하지 않는 E2E(playwright.config.ts의 webServer.env)용. 일반 dev/build/start에는
// 이 env가 설정되지 않아 영향 없다(PM 확인, 2026-07-18).
export function createOCRProvider(): OCRProvider {
  if (process.env.OCR_PROVIDER === "fixture") {
    return new FixtureOCRProvider();
  }
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_VISION_API_KEY가 설정되지 않았습니다");
  }
  return new GoogleVisionProvider(apiKey);
}
