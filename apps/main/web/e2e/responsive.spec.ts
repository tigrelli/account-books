import { test, expect, type Page } from "@playwright/test";

// T-5-1: 반응형 대응(F-1-9-1)은 완료 당시 수동 뷰포트 전환 검증만 했다 — 완전한 크로스 디바이스
// 점검은 별도 TASK(T-5-3) 몫으로 남기고, 여기서는 모바일 드로어 내비게이션이 실제로 열리고
// 닫히는지, 데스크탑에서는 고정 사이드바가 보이는지만 회귀 스모크로 확인한다.

const testEmail = () => `resp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "반응형테스트";

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

test.describe("F-1-9-1 반응형 — 모바일", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("햄버거 메뉴로 드로어를 열고 항목을 눌러 이동하면 드로어가 닫힌다", async ({ page }) => {
    await signUpAndLogin(page);

    // 홈 화면에는 사이드바 링크("지출 입력") 외에 대시보드 CTA 버튼("+ 지출 입력")도 있어
    // getByRole의 기본 부분일치로는 둘 다 잡힌다 — nav(사이드바)로 좁히고 exact 매치로 확인.
    await expect(page.getByLabel("메뉴 열기")).toBeVisible();
    await expect(
      page.locator("nav").getByRole("link", { name: "지출 입력", exact: true })
    ).not.toBeVisible();

    await page.getByLabel("메뉴 열기").click();
    await expect(page.getByText("메뉴", { exact: true })).toBeVisible();

    // 데스크탑용 고정 사이드바(md:flex로 CSS만 숨김)와 모바일 드로어가 같은 <nav>를 각자 렌더링해
    // DOM에 "지출 입력" 링크가 2개 존재한다 — "메뉴" 텍스트를 포함한 <aside>(드로어)로 좁혀서 클릭.
    const drawer = page.locator("aside").filter({ hasText: "메뉴" });
    await drawer.getByRole("link", { name: "지출 입력", exact: true }).click();

    await expect(page).toHaveURL("/expenses/create");
    await expect(page.getByText("메뉴", { exact: true })).not.toBeVisible();
  });
});

test.describe("F-1-9-1 반응형 — 데스크탑", () => {
  test("고정 사이드바가 보이고 햄버거 메뉴는 없다", async ({ page }) => {
    await signUpAndLogin(page);

    await expect(
      page.locator("nav").getByRole("link", { name: "지출 입력", exact: true })
    ).toBeVisible();
    await expect(page.getByLabel("메뉴 열기")).not.toBeVisible();
  });
});
