import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

// 테스트용 고유 계정 생성 — OCR은 OCR_PROVIDER=fixture(playwright.config.ts)로 결정적
// 결과를 반환하므로 업로드하는 사진 파일 자체의 내용은 무시된다(브라우저 압축 단계에는 실제
// 디코딩 가능한 이미지가 필요할 뿐). docs/sample/의 실사진(개인정보 포함)은 .gitignore
// 처리돼 있어 CI 체크아웃엔 없다 — 대신 커밋된 합성 픽스처 이미지를 쓴다
// (2026-07-19, 실제 CI 실행에서 ENOENT로 발견).
const testEmail = () => `ub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "관리비테스트";
const samplePhoto = path.resolve(__dirname, "./fixtures/utility-bill-sample.png");

// lib/ocr/fixture-provider.ts가 청구월을 실행 시점의 "이번 달"로 생성한다 — 여기서도 동일하게
// 계산해 기대값을 맞춘다(고정 문자열로 두면 달이 바뀌는 순간부터 깨짐).
const currentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

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

test.describe("T-2-2 관리비 명세서 — 최초 업로드 → 항목 선정 → 저장", () => {
  test("최초 업로드는 항목 선정 화면을 거쳐 선택한 항목만 저장된다", async ({ page }) => {
    await signUpAndLogin(page);

    await page.goto("/utility-bills/upload");
    await page.setInputFiles('input[type="file"]', samplePhoto);

    // 신규 계정은 활성 UTILITY_BILL_ITEM이 없어 매칭률 0% — 항상 항목 선정 화면으로 간다.
    await page.waitForURL(/\/utility-bills\/upload\/items/, { timeout: 30000 });

    const rows = page.locator('label:has(input[type="checkbox"])');
    await expect(rows).toHaveCount(4); // 보험료/소독비/전기료(세대)/수도료(세대)
    await expect(page.getByText("사용량 연결됨").first()).toBeVisible();

    // 전체 해제 시 최소 1개 검증(F-2-2-2)이 걸린다.
    for (let i = 0; i < (await rows.count()); i++) {
      await rows.nth(i).locator('input[type="checkbox"]').uncheck();
    }
    await expect(page.getByText("최소 1개 이상 선택해주세요")).toBeVisible();
    await expect(page.getByRole("button", { name: "선택한 항목으로 저장" })).toBeDisabled();

    // "소독비"만 해제하고 나머지는 선택된 상태로 저장.
    for (let i = 0; i < (await rows.count()); i++) {
      await rows.nth(i).locator('input[type="checkbox"]').check();
    }
    await rows.filter({ hasText: "소독비" }).locator('input[type="checkbox"]').uncheck();
    await page.getByRole("button", { name: "선택한 항목으로 저장" }).click();

    // 항목 선정 화면은 선택만 저장하고 업로드 화면(F-2-1-3 확인화면)으로 돌아간다 — 최초라
    // "직전 결제수단" 이력이 없어 결제수단 선택 팝업이 먼저 뜬다.
    await page.waitForURL(/\/utility-bills\/upload$/, { timeout: 15000 });
    await expect(page.getByText("결제수단과 지출일을 선택해주세요")).toBeVisible();
    await page.getByRole("button", { name: "확인" }).click();

    // 확인 화면에는 해제한 "소독비"가 빠지고 나머지 항목만 보인다.
    await expect(page.getByText(`${currentPeriod()} 청구월`)).toBeVisible();
    await expect(page.getByText("소독비")).toHaveCount(0);
    await expect(page.getByText("보험료")).toBeVisible();

    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("관리비는 말일로 지출 등록됩니다.")).toBeVisible();
    await page.getByRole("button", { name: "확인" }).click();

    await page.waitForURL(/\/expenses/, { timeout: 10000 });
    await expect(page.getByText("관리사무소")).toBeVisible();
  });
});
