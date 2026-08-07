import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// T-5-3: 반응형 크로스 디바이스 점검(F-1-9-1). T-5-1의 `responsive.spec.ts`는 모바일 드로어/데스크탑
// 사이드바만 확인한 스모크였다 — 이번엔 ①아직 한 번도 exercised된 적 없는 "태블릿" 티어(768~1023px,
// `useViewportTier`)의 페이지네이션 크기(15건)가 데스크탑(20건)과 실제로 다르게 동작하는지, ②모바일/
// 태블릿/데스크탑 각 뷰포트에서 주요 화면에 가로 스크롤(레이아웃 깨짐의 대표 증상)이 생기지 않는지를
// 확인한다.

const SUPABASE_URL = "http://127.0.0.1:54321";
// T-5-2(rls-security.spec.ts)와 동일 — Supabase CLI가 로컬 개발용으로 고정 발급하는 데모 anon key.
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const testPassword = "testpass123!";

function uniqueEmail(tag: string): string {
  return `xdev_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
}

interface Session {
  accessToken: string;
  userId: string;
}

function authHeaders(accessToken: string) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function signUpRest(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<Session> {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/signup`, {
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    data: { email, password },
  });
  expect(res.ok(), `REST 가입 실패: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return { accessToken: body.access_token, userId: body.user.id };
}

// UI로 이미 가입한 계정과 같은 자격증명으로 REST 세션을 하나 더 얻는다 — 그 계정 소유로 REST에서
// 빠르게 데이터(지출 등)를 만들어 두면, 같은 브라우저(page)로 로그인해 화면에서 바로 확인 가능.
async function loginRest(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<Session> {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    data: { email, password },
  });
  expect(res.ok(), `REST 로그인 실패: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return { accessToken: body.access_token, userId: body.user.id };
}

async function selectFirst(
  request: APIRequestContext,
  session: Session,
  table: string,
  filter: string
): Promise<{ id: string }> {
  const res = await request.get(`${SUPABASE_URL}/rest/v1/${table}?${filter}&select=id&limit=1`, {
    headers: authHeaders(session.accessToken),
  });
  expect(res.ok()).toBeTruthy();
  const [row] = await res.json();
  expect(row, `${table}에서 ${filter} 조건에 맞는 행을 찾지 못함`).toBeTruthy();
  return row;
}

async function insertOne(
  request: APIRequestContext,
  session: Session,
  table: string,
  payload: Record<string, unknown>
): Promise<{ id: string }> {
  const res = await request.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: { ...authHeaders(session.accessToken), Prefer: "return=representation" },
    data: payload,
  });
  expect(res.ok(), `${table} insert 실패: ${res.status()} ${await res.text()}`).toBeTruthy();
  const [row] = await res.json();
  return row;
}

async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");
}

async function signUpAndLogin(page: Page): Promise<string> {
  const email = uniqueEmail("smoke");
  await page.goto("/signup");
  await page.fill("#name", "반응형테스트");
  await page.fill("#email", email);
  await page.fill("#password", testPassword);
  await page.fill("#confirmPassword", testPassword);
  await page.click('button[type="submit"]');
  await expect(page.getByText("가입이 완료되었습니다")).toBeVisible();

  await loginViaUI(page, email, testPassword);
  return email;
}

async function expectNoHorizontalOverflow(
  page: Page,
  path: string,
  viewportName: string
): Promise<void> {
  await page.goto(path);
  // ⚠️ document.documentElement.scrollWidth는 여기서 못 쓴다 — globals.css의 html/body에
  // `max-width: 100vw` + `overflow-x: hidden`이 걸려있던 시절엔 documentElement의 scrollWidth
  // 자체가 뷰포트 폭으로 항상 clamp됐다(실제로 내용이 넘쳐도 절대 안 커짐, 실측 확인함). 이 CSS를
  // 제거한 뒤에도 body.scrollWidth 기준을 그대로 유지 — 기준이 일관돼야 제거 전/후 비교가 유효하다.
  const overflowed = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
  expect(overflowed, `${path}가 ${viewportName} 뷰포트에서 가로 스크롤 발생`).toBe(false);
}

test.describe("F-1-9-1 크로스 디바이스 — 태블릿 페이지네이션 (T-5-3)", () => {
  test("태블릿은 15건, 데스크탑은 20건 기준으로 페이지가 나뉜다", async ({ page, request }) => {
    const email = uniqueEmail("page");
    const session = await signUpRest(request, email, testPassword);

    // REST로 직접 16건 삽입(15보다 많고 20보다 적음 — 태블릿에서만 2페이지로 나뉘어야 함) — UI로 16번
    // 입력폼을 거치는 대신 빠르게 데이터만 준비(폼 자체 동작은 다른 스위트가 이미 검증).
    const paymentMethod = await selectFirst(
      request,
      session,
      "payment_method",
      "is_system_default=eq.true"
    );
    const category = await selectFirst(request, session, "category", "is_system_default=eq.true");
    const vendor = await insertOne(request, session, "vendor", {
      user_id: session.userId,
      name: "크로스디바이스마트",
    });
    for (let i = 0; i < 16; i++) {
      await insertOne(request, session, "transaction", {
        user_id: session.userId,
        payment_method_id: paymentMethod.id,
        category_id: category.id,
        vendor_id: vendor.id,
        input_type: "MANUAL",
        amount: 1000 + i,
        occurred_at: new Date().toISOString(),
      });
    }

    await loginViaUI(page, email, testPassword);

    await page.setViewportSize({ width: 800, height: 900 }); // 태블릿(768~1023px)
    await page.goto("/expenses");
    await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "다음 →" })).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 }); // 데스크탑(1024px~)
    // useViewportTier는 matchMedia 'change' 리스너로 갱신되고, 티어가 바뀌면 1페이지로 자동 리셋된다.
    await expect(page.getByText("1 / 1", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "다음 →" })).toHaveCount(0);
  });
});

test.describe("F-1-9-1 크로스 디바이스 — 가로 스크롤 없음 (T-5-3)", () => {
  const viewports = [
    { name: "모바일", width: 375, height: 667 },
    { name: "태블릿", width: 800, height: 900 },
    { name: "데스크탑", width: 1280, height: 800 },
  ];
  // 로그인 전(사이드바 없는 레이아웃)과 로그인 후 전체 화면을 포함한다 — F-3-1-5(동의어 사전)는
  // 운영자 아니면 즉시 "/"로 리다이렉트돼 자기 레이아웃을 렌더링하지 않으므로 제외.
  const unauthedPaths = ["/signup", "/login"];
  const authedPaths = (transactionId: string) => [
    "/",
    "/expenses",
    "/expenses/create",
    "/expenses/calendar",
    `/expenses/${transactionId}/edit`,
    "/budgets",
    "/settings",
    "/settings/payment-methods",
    "/settings/categories",
    "/settings/vendors",
    "/settings/items",
  ];

  for (const vp of viewports) {
    test(`${vp.name}(${vp.width}px)에서 전체 화면에 가로 스크롤이 생기지 않는다`, async ({
      page,
      request,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const path of unauthedPaths) {
        await expectNoHorizontalOverflow(page, path, vp.name);
      }

      const email = await signUpAndLogin(page);
      // 같은 계정으로 REST 세션을 하나 더 얻어 지출 1건을 빠르게 만들어 둔다 — `/expenses/[id]/edit`
      // (동적 라우트, 상세입력 폼이라 다른 화면보다 레이아웃이 복잡)까지 스캔에 포함하기 위함.
      const session = await loginRest(request, email, testPassword);
      const paymentMethod = await selectFirst(
        request,
        session,
        "payment_method",
        "is_system_default=eq.true"
      );
      const category = await selectFirst(request, session, "category", "is_system_default=eq.true");
      const vendor = await insertOne(request, session, "vendor", {
        user_id: session.userId,
        name: "크로스디바이스마트",
      });
      const transaction = await insertOne(request, session, "transaction", {
        user_id: session.userId,
        payment_method_id: paymentMethod.id,
        category_id: category.id,
        vendor_id: vendor.id,
        input_type: "MANUAL",
        amount: 12345,
        occurred_at: new Date().toISOString(),
      });

      for (const path of authedPaths(transaction.id)) {
        await expectNoHorizontalOverflow(page, path, vp.name);
      }
    });
  }
});
