import { test, expect, type Page } from "@playwright/test";

// T-5-4: 성능 점검(대시보드 응답속도, MV/캐시 효과 확인). MV(S-3-1~3)/캐시(S-3-5~6)가 실제로
// 얼마나 효과가 있는지는 DB 레벨 EXPLAIN ANALYZE와 Redis 직접 호출로 따로 측정해 `test-scenarios.md`
// T-5-4 절에 수치로 기록했다(대량 시딩 데이터가 필요해 CI에 상시 도는 자동 테스트로 남기기엔
// 적합하지 않음 — 네트워크 의존적인 절대 수치 비교는 CI에서 flaky해지기 쉬움).
//
// 여기 커밋된 테스트는 그와 다른 역할이다: "얼마나 빠른가"의 정밀 측정이 아니라, "터무니없이
// 느려지지 않았는가"를 매 회귀 실행마다 자동으로 감시하는 예산(budget) 가드 — 예를 들어 나중에
// 누군가 실수로 N+1 쿼리를 넣거나 캐시/MV 사용을 제거해도 이 테스트가 잡아낼 수 있도록.

const testEmail = () => `perf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";

async function signUpAndLogin(page: Page): Promise<void> {
  await page.goto("/signup");
  await page.fill("#name", "성능테스트");
  await page.fill("#email", testEmail());
  await page.fill("#password", testPassword);
  await page.fill("#confirmPassword", testPassword);
  await page.click('button[type="submit"]');
  await expect(page.getByText("이메일을 확인해 주세요")).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL("/");
}

test.describe("F-5-1 대시보드 응답 시간 예산 (T-5-4)", () => {
  test("대시보드는 예산 안(5초) 내에 로드된다 — 반복 방문도 동일", async ({ page }) => {
    await signUpAndLogin(page);

    const BUDGET_MS = 5000;

    const start1 = Date.now();
    await page.goto("/", { waitUntil: "networkidle" });
    const first = Date.now() - start1;

    const start2 = Date.now();
    await page.goto("/", { waitUntil: "networkidle" });
    const second = Date.now() - start2;

    console.log(`대시보드 로드 시간 — 1회차: ${first}ms, 2회차(캐시 워밍 후): ${second}ms`);

    expect(
      first,
      `첫 로드가 예산(${BUDGET_MS}ms)을 초과함 — MV/캐시 미사용 회귀나 N+1 쿼리 의심`
    ).toBeLessThan(BUDGET_MS);
    expect(second, `재방문 로드가 예산(${BUDGET_MS}ms)을 초과함`).toBeLessThan(BUDGET_MS);
  });
});
