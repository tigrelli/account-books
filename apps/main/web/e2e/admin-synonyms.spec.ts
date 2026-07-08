import { test, expect, type Page } from "@playwright/test";

// T-5-1: 동의어 사전 관리 화면(F-3-1-5, 운영자 전용)은 완료 세션 때 실제 운영자 계정으로 CRUD를
// 수동 Playwright 검증만 했다(진행현황.md 참고) — 그 계정은 ADMIN_EMAILS에 등록된 PM의 실제
// 이메일이라, 반복 실행되는 자동화 테스트가 로그인해 쓰기 동작(등록/삭제)까지 재현하는 건 안전하지
// 않다(운영 계정 데이터 오염 위험). 대신 이 회귀 스위트는 "일반 사용자는 절대 못 들어간다"는
// 보안 경계만 자동화한다 — 운영자 화이트리스트 로직 자체는 __tests__/admin.test.ts가 커버한다.

const testEmail = () =>
  `nonadmin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "일반사용자테스트";

async function signUpAndLogin(page: Page): Promise<void> {
  await page.goto("/signup");
  await page.fill("#name", testName);
  await page.fill("#email", testEmail());
  await page.fill("#password", testPassword);
  await page.fill("#confirmPassword", testPassword);
  await page.click('button[type="submit"]');
  await expect(page.getByText("이메일을 확인해 주세요")).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL("/");
}

test.describe("F-3-1-5 동의어 사전 관리 — 비인가 접근 차단", () => {
  test("일반 사용자에게는 사이드바에 메뉴가 보이지 않는다", async ({ page }) => {
    await signUpAndLogin(page);
    await expect(page.getByRole("link", { name: "동의어 사전 관리" })).toHaveCount(0);
  });

  test("일반 사용자가 URL을 직접 입력해 접근을 시도해도 홈으로 리다이렉트된다", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await page.goto("/admin/synonyms");
    await expect(page).toHaveURL("/");
  });
});
