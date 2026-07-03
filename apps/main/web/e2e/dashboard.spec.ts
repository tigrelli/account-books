import { test, expect, type Page } from "@playwright/test";

// 테스트용 고유 계정 생성 (병렬 실행 충돌 방지) — 신규 가입 시 트리거로 기본 카테고리/현금 지출분류가 자동 생성됨.
const testEmail = () => `dash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "대시보드테스트";

// enable_confirmations = false인 로컬 환경에서는 signUp이 즉시 세션 쿠키를 발급하므로
// (auth.spec.ts의 "가입→로그인" 흐름과 달리) 별도 /login 단계 없이 바로 로그인 상태가 된다.
async function signUpAndLogin(page: Page): Promise<void> {
  const email = testEmail();

  await page.goto("/signup");
  await page.fill("#name", testName);
  await page.fill("#email", email);
  await page.fill("#password", testPassword);
  await page.fill("#confirmPassword", testPassword);
  await page.click('button[type="submit"]');
  await expect(page.getByText("이메일을 확인해 주세요")).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL("/");
}

async function submitExpense(page: Page, vendorName: string, amount: string): Promise<void> {
  await page.goto("/expenses/create");
  await page.selectOption('select[name="paymentMethodId"]', { index: 1 });
  await page.selectOption('select[name="categoryId"]', { index: 1 });
  await page.fill('input[name="vendorName"]', vendorName);
  // 금액은 천단위 콤마 표시용 텍스트 입력이라 name 없음 — 실제 제출값은 옆의 hidden input(name="amount")이 담당.
  await page.fill('input[placeholder="0"]', amount);
  await page.click('button[type="submit"]');
  await expect(page.getByText("저장되었습니다")).toBeVisible();
}

test.describe("대시보드 — 지출 없음", () => {
  test("지출 내역이 없으면 빈 상태 문구가 표시된다", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/");

    await expect(page.getByText("₩0", { exact: true })).toBeVisible();
    await expect(page.getByText("비교할 전월 데이터 없음")).toBeVisible();
    await expect(page.getByText("아직 지출 내역이 없어요")).toHaveCount(3); // 월별추이 + 카테고리별 + 지출분류별
  });
});

test.describe("대시보드 — 지출 입력 후 반영", () => {
  test("지출을 입력하면 이번달 총지출에 반영된다", async ({ page }) => {
    await signUpAndLogin(page);
    await submitExpense(page, "테스트마트", "15000");

    await page.goto("/");
    await expect(page.getByText("₩15,000", { exact: true })).toBeVisible();
  });

  test("지출을 입력하면 카테고리별/지출분류별 차트에 반영된다", async ({ page }) => {
    await signUpAndLogin(page);
    await submitExpense(page, "테스트마트", "15000");

    await page.goto("/");
    await expect(page.getByText("아직 지출 내역이 없어요")).toHaveCount(0);
    // 카테고리별(단일 카테고리)·지출분류별(현금 지갑 단독) 차트 모두 100%로 표시됨
    await expect(page.getByText("· 100%").first()).toBeVisible();
  });

  test("여러 건 입력 시 이번달 총지출이 누적 합산된다", async ({ page }) => {
    await signUpAndLogin(page);
    await submitExpense(page, "테스트마트", "15000");
    await submitExpense(page, "편의점", "3000");

    await page.goto("/");
    await expect(page.getByText("₩18,000", { exact: true })).toBeVisible();
  });
});
