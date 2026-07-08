import { test, expect, type Page } from "@playwright/test";

// T-3-2: 상세항목 Top10(S-3-6) Redis 캐시가 지출 등록/삭제 시 실제로 무효화되는지 검증한다.
// T-3-1(stats-accuracy)은 등록만 한 뒤 홈에 "처음" 진입하는 흐름이라 캐시 미스(RPC 계산) 경로만
// 탄다 — 이 테스트는 "먼저 홈에 진입해 캐시를 채운 뒤" 데이터를 바꾸고 다시 진입해, 캐시가 무효화되지
// 않았다면 낡은 값이 그대로 보였을 시나리오를 재현한다.

const testEmail = () => `cache_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "캐시무효화테스트";

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

async function submitDetailExpense(
  page: Page,
  vendorName: string,
  itemName: string,
  quantityText: string,
  amount: string
): Promise<void> {
  await page.goto("/expenses/create");
  await page.selectOption('select[name="paymentMethodId"]', { index: 1 });
  await page.selectOption('select[name="categoryId"]', { index: 1 });
  await page.fill('input[name="vendorName"]', vendorName);
  await page.click('button:has-text("+상세항목")');
  await page.fill('input[name="detailItemText"]', itemName);
  await page.fill('input[name="detailQuantityText"]', quantityText);
  await page.fill('input[placeholder="금액"]', amount);
  await page.click('button[type="submit"]');
  await expect(page.getByText("저장되었습니다")).toBeVisible();
}

test.describe("F-3-1-3 상세항목 Top10 — 캐시 무효화 (T-3-2)", () => {
  test("이미 캐시된 상태에서 같은 품목을 추가 등록하면, 재조회 시 낡은 값이 아니라 합산된 최신값이 보인다", async ({
    page,
  }) => {
    await signUpAndLogin(page);

    await submitDetailExpense(page, "이마트", "감자", "1개", "3000");
    // 첫 홈 진입 — item_top10 캐시가 이 시점 값(3,000원)으로 채워진다.
    await page.goto("/");
    const itemSection = page.locator("section", { hasText: "상세항목 Top 10" });
    await expect(itemSection.getByText("₩3,000")).toBeVisible();

    await submitDetailExpense(page, "쿠팡", "감자", "1개", "2000");
    // 캐시가 무효화되지 않았다면 TTL(5분) 내엔 여전히 3,000원이 보였을 것.
    await page.goto("/");
    await expect(itemSection.getByText("₩5,000")).toBeVisible();
    await expect(itemSection.getByText("₩3,000")).not.toBeVisible();
  });

  test("이미 캐시된 상태에서 지출을 삭제하면, 재조회 시 캐시가 아니라 삭제 반영된 최신 상태가 보인다", async ({
    page,
  }) => {
    await signUpAndLogin(page);

    await submitDetailExpense(page, "이마트", "고구마", "1개", "4000");
    // 첫 홈 진입 — item_top10 캐시가 "고구마" 포함 상태로 채워진다.
    await page.goto("/");
    const itemSection = page.locator("section", { hasText: "상세항목 Top 10" });
    await expect(itemSection.getByText("고구마")).toBeVisible();

    await page.goto("/expenses/calendar");
    await page.click('button:has-text("이마트")');
    await expect(page.getByText("지출 수정")).toBeVisible();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page.getByText("이 지출 내역을 삭제하시겠습니까?")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page.getByText("지출 수정")).not.toBeVisible();

    // 캐시가 무효화되지 않았다면 TTL(5분) 내엔 삭제된 "고구마"가 여전히 보였을 것.
    await page.goto("/");
    await expect(itemSection.getByText("고구마")).toHaveCount(0);
    await expect(itemSection.getByText("아직 지출 내역이 없어요")).toBeVisible();
  });
});
