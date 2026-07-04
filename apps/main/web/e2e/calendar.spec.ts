import { test, expect, type Page } from "@playwright/test";

// dashboard.spec.ts와 동일 — 로컬 enable_confirmations=false 환경에서는 signUp이 즉시 세션을 발급.
const testEmail = () => `cal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "캘린더테스트";

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

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

test.describe("지출 캘린더 — 진입/토글", () => {
  test("지출 내역 목록에서 캘린더로 토글하면 월별 그리드가 표시된다", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/expenses");
    await page.click('a:has-text("캘린더")');
    await expect(page).toHaveURL(/\/expenses\/calendar/);
    await expect(page.getByText("일")).toBeVisible();
    await expect(page.getByText("토")).toBeVisible();
  });

  test("캘린더에서 목록으로 다시 토글할 수 있다", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/expenses/calendar");
    await page.click('a:has-text("목록")');
    await expect(page).toHaveURL("/expenses");
  });

  test("이전 달/다음 달 이동 시 기간 표시가 바뀐다", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/expenses/calendar?period=2026-07");
    await expect(page.getByText("2026-07", { exact: true })).toBeVisible();

    await page.click('a:has-text("다음 달")');
    await expect(page).toHaveURL(/period=2026-08/);
    await expect(page.getByText("2026-08", { exact: true })).toBeVisible();

    await page.click('a:has-text("이전 달")');
    await expect(page).toHaveURL(/period=2026-07/);
    await page.click('a:has-text("이전 달")');
    await expect(page).toHaveURL(/period=2026-06/);
  });
});

test.describe("지출 캘린더 — 빠른 입력 팝업", () => {
  test("날짜의 +를 누르면 그 날짜가 채워진 빠른 입력 팝업이 뜬다", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/expenses/calendar");

    const key = todayKey();
    await page.locator(`button[aria-label="${key} 지출 빠른 입력"]`).click({ force: true });

    await expect(page.getByText(`${key} 지출 입력`)).toBeVisible();
    await expect(page.locator('input[name="occurredAt"]')).toHaveValue(key);
  });

  test("팝업에서 지출을 저장하면 팝업이 닫히고 캘린더에 즉시 반영된다", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/expenses/calendar");

    const key = todayKey();
    await page.locator(`button[aria-label="${key} 지출 빠른 입력"]`).click({ force: true });
    await expect(page.getByText(`${key} 지출 입력`)).toBeVisible();

    await page.locator('select[name="paymentMethodId"]').last().selectOption({ index: 1 });
    await page.locator('select[name="categoryId"]').last().selectOption({ index: 1 });
    await page.locator('input[name="vendorName"]').last().fill("빠른입력테스트마트");
    await page.locator('input[placeholder="0"]').last().fill("7700");
    await page.locator('button[type="submit"]:has-text("저장하기")').last().click();

    // 팝업이 닫힌다
    await expect(page.getByText(`${key} 지출 입력`)).not.toBeVisible();
    // 같은 라우트에 머무른 채로 캘린더 데이터가 갱신되어 새 지출이 보인다(별도 새로고침 없이).
    await expect(page.getByText("7,700").first()).toBeVisible();
  });
});

test.describe("지출 캘린더 — 수정/삭제 팝업", () => {
  async function addTodayExpense(page: Page, vendorName: string, amount: string): Promise<void> {
    await page.goto("/expenses/create");
    await page.selectOption('select[name="paymentMethodId"]', { index: 1 });
    await page.selectOption('select[name="categoryId"]', { index: 1 });
    await page.fill('input[name="vendorName"]', vendorName);
    await page.fill('input[placeholder="0"]', amount);
    await page.click('button[type="submit"]');
    await expect(page.getByText("저장되었습니다")).toBeVisible();
  }

  test("캘린더에서 기존 지출을 클릭하면 페이지 이동 없이 수정 팝업이 뜬다", async ({ page }) => {
    await signUpAndLogin(page);
    await addTodayExpense(page, "수정팝업마트", "8800");

    await page.goto("/expenses/calendar");
    await page.click('button:has-text("수정팝업마트")');

    await expect(page.getByText("지출 수정")).toBeVisible();
    await expect(page).toHaveURL(/\/expenses\/calendar/);
    await expect(page.locator('input[name="vendorName"]').last()).toHaveValue("수정팝업마트");
  });

  test("수정 팝업에서 저장하면 팝업이 닫히고 캘린더에 즉시 반영된다", async ({ page }) => {
    await signUpAndLogin(page);
    await addTodayExpense(page, "수정전마트", "1000");

    await page.goto("/expenses/calendar");
    await page.click('button:has-text("수정전마트")');
    await expect(page.getByText("지출 수정")).toBeVisible();

    await page.locator('input[placeholder="0"]').last().fill("2000");
    await page.locator('button[type="submit"]:has-text("수정하기")').last().click();

    await expect(page.getByText("지출 수정")).not.toBeVisible();
    await expect(page).toHaveURL(/\/expenses\/calendar/);
    await expect(page.getByText("2,000").first()).toBeVisible();
  });

  test("수정 팝업에서 삭제하면 팝업이 닫히고 캘린더에서 사라진다", async ({ page }) => {
    await signUpAndLogin(page);
    await addTodayExpense(page, "삭제팝업마트", "5500");

    await page.goto("/expenses/calendar");
    await page.click('button:has-text("삭제팝업마트")');
    await expect(page.getByText("지출 수정")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.click('button:has-text("이 지출 내역 삭제")');

    await expect(page.getByText("지출 수정")).not.toBeVisible();
    await expect(page).toHaveURL(/\/expenses\/calendar/);
    await expect(page.getByText("삭제팝업마트")).toHaveCount(0);
  });
});
