import { test, expect, type Page } from "@playwright/test";

// T-5-1: 품목 마스터 관리 화면(F-1-6-1~3, 별칭 추가/수동 병합)은 병합 로직 자체는
// __tests__/item-merge.test.ts(순수 함수)로 검증돼 있었지만, 화면(ItemSection.tsx) 자체의 e2e
// 회귀는 없었다 — 전체 기능 회귀테스트 범위에 새로 포함한다.

const testEmail = () => `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "품목관리테스트";

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

async function submitDetailExpense(
  page: Page,
  vendorName: string,
  itemName: string
): Promise<void> {
  await page.goto("/expenses/create");
  await page.selectOption('select[name="paymentMethodId"]', { index: 1 });
  await page.selectOption('select[name="categoryId"]', { index: 1 });
  await page.fill('input[name="vendorName"]', vendorName);
  await page.click('button:has-text("+상세항목")');
  await page.fill('input[name="detailItemText"]', itemName);
  await page.fill('input[name="detailQuantityText"]', "1개");
  await page.fill('input[placeholder="금액"]', "1000");
  await page.click('button[type="submit"]');
  await expect(page.getByText("저장되었습니다")).toBeVisible();
}

// ItemRow 구조: <div.행><div.이름줄><p>{name}</p></div><div.컨트롤줄>...</div></div> — 이름의 <p>에서
// 정확히 두 단계 위로 올라가면 행 전체 컨테이너다. 버튼 텍스트(예: "+ 별칭 추가" → 입력폼으로 전환)로
// 행을 찾으면 클릭 후 그 텍스트가 사라져 락터가 깨지므로, 상태와 무관한 구조적 위치로 고정한다.
function itemRowFor(page: Page, itemName: string) {
  return page.getByText(itemName, { exact: true }).locator("..").locator("..");
}

test.describe("F-1-6-1~2 품목 목록 + 별칭 추가", () => {
  test("상세항목으로 등록한 품목이 목록에 나타나고, 별칭을 추가할 수 있다", async ({ page }) => {
    await signUpAndLogin(page);
    await submitDetailExpense(page, "이마트", "당근");

    await page.goto("/settings/items");
    await expect(page.locator("p", { hasText: "당근" })).toBeVisible();

    const row = itemRowFor(page, "당근");
    await row.getByRole("button", { name: "+ 별칭 추가" }).click();
    await row.getByPlaceholder("별칭 (예: 대파)").fill("홍당무");
    await row.getByRole("button", { name: "추가" }).click();

    // AliasTag는 <span>{alias}<button>삭제 ×</button></span> 구조라 span 전체 텍스트는
    // "홍당무×"다 — exact 매치 대신 부분 일치로 확인한다.
    await expect(row.getByText("홍당무")).toBeVisible();
  });
});

test.describe("F-1-6-3 품목 수동 병합", () => {
  test("한 품목을 다른 품목으로 병합하면 목록에서 사라지고, 대상 품목의 별칭으로 흡수된다", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    // 같은 지출처를 연달아 쓰면 지출처 자동완성 드롭다운이 다음 버튼(+상세항목)을 가려버려
    // (VendorCombobox), 두 번째 등록은 다른 지출처명으로 진행한다.
    await submitDetailExpense(page, "이마트", "감자");
    await submitDetailExpense(page, "쿠팡", "고구마");

    await page.goto("/settings/items");
    await expect(page.locator("p", { hasText: "감자" })).toBeVisible();
    await expect(page.locator("p", { hasText: "고구마" })).toBeVisible();

    const potatoRow = itemRowFor(page, "감자");
    await potatoRow.getByRole("button", { name: "병합" }).click();
    await potatoRow.locator("select").selectOption({ label: "고구마" });

    page.once("dialog", (dialog) => dialog.accept());
    await potatoRow.getByRole("button", { name: "병합하기" }).click();

    // 병합된 "감자"는 품목 이름(<p>)으로는 더 이상 존재하지 않고, "고구마"의 별칭 태그(<span>)로만 남는다.
    await expect(page.locator("p", { hasText: "감자" })).toHaveCount(0);
    const sweetPotatoRow = itemRowFor(page, "고구마");
    await expect(sweetPotatoRow.getByText("감자")).toBeVisible();
  });
});
