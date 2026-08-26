import { test, expect, type Page } from "@playwright/test";

const testEmail = () => `cal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "캘린더테스트";

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
    // F-1-5-12(페이지네이션) 이후 목록 화면은 진입 시 ?page=1로 정규화된다.
    await expect(page).toHaveURL(/\/expenses(\?page=1)?$/);
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

    await page.locator('[data-focus-target="paymentMethodId"]').last().click();
    await page
      .locator('[data-focus-target="paymentMethodId"] + ul')
      .last()
      .locator("button")
      .nth(0)
      .click();
    await page.locator('[data-focus-target="categoryId"]').last().click();
    await page
      .locator('[data-focus-target="categoryId"] + ul')
      .last()
      .locator("button")
      .nth(0)
      .click();
    await page.locator('input[name="vendorName"]').last().fill("빠른입력테스트마트");
    await page.locator('input[placeholder="0"]').last().fill("7700");
    await page.locator('button[type="submit"]:has-text("저장")').last().click();

    // 팝업이 닫힌다
    await expect(page.getByText(`${key} 지출 입력`)).not.toBeVisible();
    // 같은 라우트에 머무른 채로 캘린더 데이터가 갱신되어 새 지출이 보인다(별도 새로고침 없이).
    await expect(page.getByText("7,700").first()).toBeVisible();
  });
});

test.describe("지출 캘린더 — 수정/삭제 팝업", () => {
  async function addTodayExpense(page: Page, vendorName: string, amount: string): Promise<void> {
    await page.goto("/expenses/create");
    await selectFromDropdown(page, "paymentMethodId", 0);
    await selectFromDropdown(page, "categoryId", 0);
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
    await page.locator('button[type="submit"]:has-text("수정")').last().click();

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

    // 삭제는 네이티브 confirm()이 아니라 공용 ConfirmDialog(레이어 팝업, 2026-07-05)를 거친다 —
    // 트리거 버튼("삭제")과 팝업 확인 버튼("삭제")이 이름이 같아 팝업이 뜨기 전/후로 나눠 클릭.
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page.getByText("이 지출 내역을 삭제하시겠습니까?")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "삭제", exact: true }).click();

    await expect(page.getByText("지출 수정")).not.toBeVisible();
    await expect(page).toHaveURL(/\/expenses\/calendar/);
    await expect(page.getByText("삭제팝업마트")).toHaveCount(0);
  });
});
