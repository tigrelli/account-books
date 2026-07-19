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
  // [2026-07-18 사고 재발 방지] Claude Code가 `next dev`에 자동화 스크립트(Playwright 등)를 직접
  // 붙여 업로드 플로우를 검증하다가 OCR_PROVIDER=fixture를 안 붙여서 실제 유료 Vision API를 여러
  // 번 호출한 사고가 있었다 — 그 env는 playwright.config.ts의 webServer(pnpm test:e2e)에만 설정돼
  // `next dev` 단독 실행에는 적용되지 않기 때문. 실제 호출 직전에 서버 콘솔에서 바로 보이도록 경고.
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[OCR] 실제 Vision API(유료)를 호출합니다. 자동화 스크립트로 업로드 플로우를 검증할 때는 " +
        "OCR_PROVIDER=fixture를 설정하거나 pnpm test:e2e를 사용하세요."
    );
  }
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_VISION_API_KEY가 설정되지 않았습니다");
  }
  return new GoogleVisionProvider(apiKey);
}
