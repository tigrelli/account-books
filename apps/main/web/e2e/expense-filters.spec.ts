import { test, expect, type Page } from "@playwright/test";

// T-5-1: 지출 내역 리스트 필터(F-1-1-11/F-1-5-13)는 목록↔캘린더 토글, 요약 반영 등은 다른
// 스위트가 커버하지만 필터 자체(기간/지출항목/초기화)를 검증하는 e2e가 없었다 — 전체 기능
// 회귀테스트 범위에 새로 포함한다.

const testEmail = () =>
  `filter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "필터테스트";

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

async function submitExpense(
  page: Page,
  categoryOptionIndex: number,
  vendorName: string,
  amount: string
): Promise<string> {
  await page.goto("/expenses/create");
  await page.selectOption('select[name="paymentMethodId"]', { index: 1 });
  const categorySelect = page.locator('select[name="categoryId"]');
  await categorySelect.selectOption({ index: categoryOptionIndex });
  const categoryLabel = await categorySelect.locator("option").nth(categoryOptionIndex).innerText();
  await page.fill('input[name="vendorName"]', vendorName);
  await page.fill('input[placeholder="0"]', amount);
  await page.click('button[type="submit"]');
  await expect(page.getByText("저장되었습니다")).toBeVisible();
  return categoryLabel;
}

test.describe("F-1-1-11/F-1-5-13 지출 내역 필터", () => {
  test("지출항목으로 필터링하면 해당 항목만 보이고, 초기화하면 전체가 다시 보인다", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    const categoryA = await submitExpense(page, 1, "필터가게A", "10000");
    await submitExpense(page, 2, "필터가게B", "20000");

    await page.goto("/expenses");
    // 목록 행은 "{카테고리} · {지출처}"를 한 <p>로 합쳐 렌더링하므로(ExpenseRow) exact 매치 대신
    // 부분 일치로 확인한다.
    await expect(page.getByText("필터가게A")).toBeVisible();
    await expect(page.getByText("필터가게B")).toBeVisible();

    await page.selectOption('select[name="categoryId"]', { label: categoryA });
    await page.getByRole("button", { name: "필터 적용" }).click();

    await expect(page).toHaveURL(/categoryId=/);
    await expect(page.getByText("필터가게A")).toBeVisible();
    await expect(page.getByText("필터가게B")).toHaveCount(0);

    await page.getByRole("link", { name: "초기화" }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/expenses(\?page=1)?$/);
    await expect(page.getByText("필터가게A")).toBeVisible();
    await expect(page.getByText("필터가게B")).toBeVisible();
  });

  test("조건에 맞는 지출이 없으면 빈 상태 문구와 필터 초기화 링크가 표시된다", async ({ page }) => {
    await signUpAndLogin(page);
    await submitExpense(page, 1, "필터가게C", "5000");

    await page.goto("/expenses");
    // 오늘 이후로 시작일을 잡아 아무 지출도 걸리지 않게 만든다.
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const futureDate = future.toISOString().slice(0, 10);
    await page.fill('input[name="from"]', futureDate);
    await page.getByRole("button", { name: "필터 적용" }).click();

    await expect(page.getByText("조건에 맞는 지출 내역이 없습니다")).toBeVisible();
    await expect(page.getByRole("link", { name: "필터 초기화" })).toBeVisible();
  });
});
