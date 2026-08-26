import { test, expect, type Page } from "@playwright/test";

// 테스트용 고유 계정 생성 (병렬 실행 충돌 방지) — 신규 가입 시 트리거로 기본 카테고리/현금 지출분류가 자동 생성됨.
const testEmail = () => `dash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "대시보드테스트";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = testEmail();

  await page.goto("/signup");
  await page.fill("#name", testName);
  await page.fill("#email", email);
  await page.fill("#password", testPassword);
  await page.fill("#confirmPassword", testPassword);
  await page.click('button[type="submit"]');
  await expect(page.getByText("가입이 완료되었습니다")).toBeVisible();

  await page.click('a:has-text("로그인하기")');
  await expect(page).toHaveURL(/\/login/);
  await page.fill("#email", email);
  await page.fill("#password", testPassword);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");
}

// 지출분류/지출항목은 네이티브 <select>가 아니라 커스텀 리스트박스(버튼 + ul)다 —
// Windows Chrome/Edge에서 select 드롭다운을 열었다 고르기만 해도 IME가 영문으로 초기화되는
// 문제를 피하려고 ExpenseEntryForm.tsx에서 교체함(2026-08-26). option은 index(0-base, 실제
// 항목 기준 — 자리표시자 항목이 없어 기존 select의 index 1과 대응)나 표시 텍스트로 고른다.
async function selectFromDropdown(
  page: Page,
  field: "paymentMethodId" | "categoryId",
  option: number | string
): Promise<void> {
  await page.click(`[data-focus-target="${field}"]`);
  const list = page.locator(`[data-focus-target="${field}"] + ul`);
  if (typeof option === "number") {
    await list.locator("button").nth(option).click();
  } else {
    await list.getByRole("button", { name: option }).click();
  }
}

async function submitExpense(page: Page, vendorName: string, amount: string): Promise<void> {
  await page.goto("/expenses/create");
  await selectFromDropdown(page, "paymentMethodId", 0);
  await selectFromDropdown(page, "categoryId", 0);
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
    // 월별추이 + 카테고리별 + 지출분류별 + 지출처 Top10(F-3-1-2) + 상세항목 Top10(F-3-1-3)
    await expect(page.getByText("아직 지출 내역이 없어요")).toHaveCount(5);
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
    // 상세항목 Top10(F-3-1-3)은 transaction_detail 기반이라, 상세항목 없이 등록한 이 지출로는
    // 채워지지 않고 계속 빈 상태로 남는다 — 나머지(월별추이/카테고리별/지출분류별/지출처 Top10)는 반영됨.
    await expect(page.getByText("아직 지출 내역이 없어요")).toHaveCount(1);
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
