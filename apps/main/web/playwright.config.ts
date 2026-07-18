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
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // [T-2-2] 관리비 명세서 e2e가 매 실행마다 유료 Google Vision API를 호출하지 않도록
    // 결정적 fixture provider를 쓴다(lib/ocr/index.ts, PM 확인 2026-07-18). 다른 e2e에는
    // 영향 없음 — OCR을 호출하는 화면이 관리비 명세서뿐.
    env: { OCR_PROVIDER: "fixture" },
  },
});
