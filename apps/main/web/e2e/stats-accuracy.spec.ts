import { test, expect, type Page } from "@playwright/test";

// T-3-1: 통계 정확도 검증 — MV(tx_stats/item_stats/item_unit_stats) 기반 통계 화면(F-3-1-1~4)이
// 실제 등록한 지출로부터 수동 계산한 값과 정확히 일치하는지 실 UI를 통해 검증한다.
// 트리거(S-3-4)가 각 지출 등록 즉시 MV를 CONCURRENTLY 리프레시하므로 별도 대기 없이 바로 홈에서 확인 가능.

const testEmail = () => `stats_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "통계검증테스트";

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

async function submitSimpleExpense(page: Page, vendorName: string, amount: string): Promise<void> {
  await page.goto("/expenses/create");
  await selectFromDropdown(page, "paymentMethodId", 0);
  await selectFromDropdown(page, "categoryId", 0);
  await page.fill('input[name="vendorName"]', vendorName);
  await page.fill('input[placeholder="0"]', amount);
  await page.click('button[type="submit"]');
  await expect(page.getByText("저장되었습니다")).toBeVisible();
}

async function submitDetailExpense(
  page: Page,
  vendorName: string,
  itemName: string,
  quantityText: string,
  amount: string
): Promise<void> {
  await page.goto("/expenses/create");
  await selectFromDropdown(page, "paymentMethodId", 0);
  await selectFromDropdown(page, "categoryId", 0);
  await page.fill('input[name="vendorName"]', vendorName);
  await page.click('button:has-text("+상세항목")');
  await page.fill('input[name="detailItemText"]', itemName);
  await page.fill('input[name="detailQuantityText"]', quantityText);
  await page.fill('input[placeholder="금액"]', amount);
  await page.click('button[type="submit"]');
  await expect(page.getByText("저장되었습니다")).toBeVisible();
}

test.describe("F-3-1-2 — 지출처 Top 10 정확도", () => {
  test("서로 다른 지출처 3곳의 금액이 내림차순으로, 합계 오차 없이 표시된다", async ({ page }) => {
    await signUpAndLogin(page);
    // 수동 계산: 각 지출처 1건씩이라 표시값 = 입력 금액 그대로여야 한다.
    await submitSimpleExpense(page, "가나다마트", "30000");
    await submitSimpleExpense(page, "라마상회", "20000");
    await submitSimpleExpense(page, "바사상점", "10000");

    await page.goto("/");
    const vendorTicks = page
      .locator("section", { hasText: "지출처 Top 10" })
      .locator(".recharts-cartesian-axis-tick-value");
    // Recharts 진입 애니메이션(기본 ~1.5초) 도중엔 막대/틱이 순차로 마운트되는 과정이라 카운트가
    // 일시적으로 덜 나올 수 있음(F-3-1-2 검증 때도 동일 현상 확인) — 안정화까지 대기 후 확정 개수 확인.
    await expect(vendorTicks).toHaveCount(3, { timeout: 10000 });
    await expect(vendorTicks.nth(0)).toHaveText("가나다마트"); // 내림차순 1위
    await expect(vendorTicks.nth(1)).toHaveText("라마상회");
    await expect(vendorTicks.nth(2)).toHaveText("바사상점");

    const section = page.locator("section", { hasText: "지출처 Top 10" });
    await expect(section.getByText("₩30,000")).toBeVisible();
    await expect(section.getByText("₩20,000")).toBeVisible();
    await expect(section.getByText("₩10,000")).toBeVisible();
  });
});

test.describe("F-3-1-3 — 상세항목 Top10 + 드릴다운 정확도", () => {
  test("같은 품목을 여러 지출처에서 구매하면 합계가 정확히 집계되고, 드릴다운도 지출처별로 정확히 분리된다", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    // 수동 계산: 양파 총액 = 5,000 + 3,000 = 8,000
    await submitDetailExpense(page, "이마트", "양파", "1개", "5000");
    await submitDetailExpense(page, "쿠팡", "양파", "1개", "3000");

    await page.goto("/");
    const itemSection = page.locator("section", { hasText: "상세항목 Top 10" });
    await expect(itemSection.getByText("₩8,000")).toBeVisible();

    await itemSection.getByText("양파").click();
    await expect(itemSection.getByText("이마트")).toBeVisible();
    await expect(itemSection.getByText("₩5,000")).toBeVisible();
    await expect(itemSection.getByText("쿠팡")).toBeVisible();
    await expect(itemSection.getByText("₩3,000")).toBeVisible();
  });
});

test.describe("F-3-1-4 — 품목×단위 평균단가 추이 정확도", () => {
  test("수량/금액으로 계산한 평균단가가 툴팁에 정확히 표시된다", async ({ page }) => {
    await signUpAndLogin(page);
    // 수동 계산: 4,000원 / 2kg = kg당 2,000원
    await submitDetailExpense(page, "이마트", "당근", "2kg", "4000");

    await page.goto("/");
    const unitSection = page.locator("section", { hasText: "단가 분석" });
    // 2026-07-09 재설계: 처음 진입 시 자동 선택 없음(검색 전 데이터 미표시) — 검색창에 품목명을
    // 입력해 드롭다운에서 원하는 조합을 클릭해야 해당 조합의 추이가 로드된다("검색" 버튼은 모호한
    // 1순위 자동 선택 문제로 이후 제거됨, 드롭다운 클릭 선택만 남음).
    const searchInput = unitSection.locator('input[placeholder="항목을 검색하세요"]');
    await searchInput.fill("당근");
    await unitSection.getByRole("button", { name: "당근 (kg)" }).click();
    await expect(searchInput).toHaveValue("당근 (kg)");

    const dot = unitSection.locator(".recharts-dot").last();
    await dot.hover();
    await expect(page.getByText("₩2,000 / kg")).toBeVisible();
  });
});

test.describe("F-3-1-1 — 지출분류별(현금/카드) 정확도", () => {
  test("현금과 신용카드 지출 비율이 수동 계산한 퍼센트와 일치한다", async ({ page }) => {
    await signUpAndLogin(page);

    // 카드 등록(신용카드 1개 추가) — 기본 시드는 현금뿐이라 카드 비교를 위해 별도 등록 필요.
    // 이 화면엔 "등록" 버튼이 계좌/카드 두 폼에 각각 있어, 카드 입력을 담은 폼으로 범위를 좁혀 클릭한다.
    await page.goto("/settings/payment-methods");
    const cardForm = page.locator("form", {
      has: page.locator('input[placeholder="카드사명 (예: 국민카드)"]'),
    });
    await cardForm.locator('input[placeholder="카드사명 (예: 국민카드)"]').fill("국민카드");
    await cardForm.getByRole("button", { name: "등록" }).click();
    await expect(page.getByText("국민카드")).toBeVisible();

    // 수동 계산: 현금 15,000 + 카드 5,000 = 총 20,000 → 현금 75%, 카드 25%
    await page.goto("/expenses/create");
    await selectFromDropdown(page, "paymentMethodId", 0); // 현금
    await selectFromDropdown(page, "categoryId", 0);
    await page.fill('input[name="vendorName"]', "현금가게");
    await page.fill('input[placeholder="0"]', "15000");
    await page.click('button[type="submit"]');
    await expect(page.getByText("저장되었습니다")).toBeVisible();

    await page.goto("/expenses/create");
    await selectFromDropdown(page, "paymentMethodId", "국민카드");
    await selectFromDropdown(page, "categoryId", 0);
    await page.fill('input[name="vendorName"]', "카드가게");
    await page.fill('input[placeholder="0"]', "5000");
    await page.click('button[type="submit"]');
    await expect(page.getByText("저장되었습니다")).toBeVisible();

    await page.goto("/");
    const section = page.locator("section", { hasText: "지출분류별 지출" });
    await expect(section.getByText("현금 ₩15,000 · 75%")).toBeVisible();
    await expect(section.getByText("카드 ₩5,000 · 25%")).toBeVisible();
  });
});
