import { test, expect, type Page } from "@playwright/test";

// T-5-1: 예산 화면(F-1-7-1~2)은 완료 당시 수동 Playwright 검증만 하고 회귀 스위트에 자동화된
// e2e를 남기지 않았다 — 전체 기능 회귀테스트 범위에 새로 포함한다.

const testEmail = () =>
  `budget_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "예산테스트";

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

test.describe("F-1-7-1~2 예산 설정 + 소진율 게이지", () => {
  test("전체/카테고리 예산을 등록하면, 그 카테고리에 지출을 넣었을 때 게이지에 정확한 소진율이 표시된다", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await page.goto("/budgets");

    // 첫 번째 카테고리 행(시드로 자동 생성된 기본 지출항목 중 하나)의 이름을 읽어 이후
    // 지출 입력에서 동일한 카테고리를 선택하는 데 재사용한다.
    const firstCategoryRow = page.locator("form .grid > div").first();
    const categoryName = (await firstCategoryRow.locator("span").first().innerText()).trim();

    await page.locator('input[placeholder="0"]').first().fill("100000"); // 전체 예산
    await firstCategoryRow.locator('input[placeholder="0"]').fill("50000");
    await page.getByRole("button", { name: "등록" }).click();
    await expect(page.getByText("등록이 완료되었습니다.")).toBeVisible();
    await page.getByRole("button", { name: "확인" }).click();

    // 방금 예산을 설정한 카테고리에 지출 25,000원 등록 → 50,000원 한도의 50%.
    await page.goto("/expenses/create");
    await page.selectOption('select[name="paymentMethodId"]', { index: 1 });
    await page.selectOption('select[name="categoryId"]', { label: categoryName });
    await page.fill('input[name="vendorName"]', "예산테스트마트");
    await page.fill('input[placeholder="0"]', "25000");
    await page.click('button[type="submit"]');
    await expect(page.getByText("저장되었습니다")).toBeVisible();

    await page.goto("/budgets");
    const updatedRow = page.locator("form .grid > div").filter({ hasText: categoryName }).first();
    await expect(updatedRow.getByText("25,000원 / 50,000원 · 50%")).toBeVisible();
  });
});

test.describe("F-1-7-1 예산 리셋", () => {
  test("리셋 확인 팝업에서 확인하면 예산이 즉시 0으로 초기화되고 게이지가 사라진다", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await page.goto("/budgets");

    const firstCategoryRow = page.locator("form .grid > div").first();
    const categoryName = (await firstCategoryRow.locator("span").first().innerText()).trim();

    await page.locator('input[placeholder="0"]').first().fill("100000");
    await firstCategoryRow.locator('input[placeholder="0"]').fill("50000");
    await page.getByRole("button", { name: "등록" }).click();
    await expect(page.getByText("등록이 완료되었습니다.")).toBeVisible();
    await page.getByRole("button", { name: "확인" }).click();
    await expect(page.getByText("등록이 완료되었습니다.")).not.toBeVisible();

    await page.getByRole("button", { name: "리셋" }).click();
    await expect(page.getByText("전체 항목 예산을 초기화하시겠습니까?")).toBeVisible();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "초기화", exact: true })
      .click();
    await expect(page.getByText("초기화되었습니다.")).toBeVisible();
    await page.getByRole("button", { name: "확인" }).click();

    const resetRow = page.locator("form .grid > div").filter({ hasText: categoryName }).first();
    await expect(resetRow.getByText("/ 50,000원")).toHaveCount(0);
  });
});
