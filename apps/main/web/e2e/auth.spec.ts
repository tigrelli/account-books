import { test, expect } from "@playwright/test";

// 테스트용 고유 계정 생성 (병렬 실행 충돌 방지)
const testEmail = () => `test_${Date.now()}@example.com`;
const testPassword = "testpass123!";
const testName = "테스트유저";

test.describe("회원가입", () => {
  test("유효한 정보로 회원가입하면 이메일 안내 화면이 표시된다", async ({ page }) => {
    await page.goto("/signup");
    await page.fill("#name", testName);
    await page.fill("#email", testEmail());
    await page.fill("#password", testPassword);
    await page.fill("#confirmPassword", testPassword);
    await page.click('button[type="submit"]');

    // enable_confirmations = false이므로 성공 화면(이메일 확인 안내)으로 이동
    await expect(page.getByText("이메일을 확인해 주세요")).toBeVisible();
  });

  test("이메일 형식이 잘못되면 필드 에러가 표시된다", async ({ page }) => {
    await page.goto("/signup");
    await page.fill("#name", testName);
    await page.fill("#email", "not-an-email");
    await page.fill("#password", testPassword);
    await page.fill("#confirmPassword", testPassword);
    await page.click('button[type="submit"]');

    await expect(page.getByText("올바른 이메일 주소를 입력해 주세요")).toBeVisible();
  });

  test("비밀번호가 일치하지 않으면 필드 에러가 표시된다", async ({ page }) => {
    await page.goto("/signup");
    await page.fill("#name", testName);
    await page.fill("#email", testEmail());
    await page.fill("#password", testPassword);
    await page.fill("#confirmPassword", "differentpass!");
    await page.click('button[type="submit"]');

    await expect(page.getByText("비밀번호가 일치하지 않습니다")).toBeVisible();
  });
});

test.describe("로그인", () => {
  test("잘못된 자격증명으로 로그인하면 에러 메시지가 표시된다", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "nonexistent@example.com");
    await page.fill("#password", "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(page.getByText("이메일 또는 비밀번호가 올바르지 않습니다")).toBeVisible();
  });

  test("로그인하지 않고 보호된 경로 접근 시 로그인 페이지로 이동한다", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("가입 → 로그인 → 로그아웃 전체 흐름", () => {
  test("회원가입 후 로그인하고 로그아웃까지 완료된다", async ({ page }) => {
    const email = testEmail();

    // 1. 회원가입
    await page.goto("/signup");
    await page.fill("#name", testName);
    await page.fill("#email", email);
    await page.fill("#password", testPassword);
    await page.fill("#confirmPassword", testPassword);
    await page.click('button[type="submit"]');
    await expect(page.getByText("이메일을 확인해 주세요")).toBeVisible();

    // 2. 로그인 (로컬 Supabase는 enable_confirmations = false)
    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", testPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");

    // 3. 로그아웃
    await page.goto("/settings");
    await page.click('button:has-text("로그아웃")');
    await expect(page).toHaveURL(/\/login/);
  });
});
