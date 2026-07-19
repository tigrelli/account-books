import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // [2026-07-19 CI 안정화] turbo.json의 test:e2e가 이미 build에 의존해 프로덕션 빌드가
    // 먼저 끝나 있는데, 여기서 "next dev"(Turbopack)로 다시 띄우면 그 빌드를 안 쓰고
    // 라우트마다 온디맨드 컴파일이 새로 발생한다 — CPU가 제한적인 CI 러너에서 첫 방문
    // 라우트마다 지연이 생겨 무관한 테스트 10여 개가 flaky하게 실패하는 원인이었다(실제
    // CI 실행 로그로 확인). 이미 끝난 빌드를 그대로 서빙하는 "next start"로 전환.
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // [T-2-2] 관리비 명세서 e2e가 매 실행마다 유료 Google Vision API를 호출하지 않도록
    // 결정적 fixture provider를 쓴다(lib/ocr/index.ts, PM 확인 2026-07-18). 다른 e2e에는
    // 영향 없음 — OCR을 호출하는 화면이 관리비 명세서뿐.
    env: { OCR_PROVIDER: "fixture" },
  },
});
