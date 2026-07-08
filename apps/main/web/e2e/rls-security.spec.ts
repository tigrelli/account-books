import { test, expect, type APIRequestContext } from "@playwright/test";

// T-5-2: RLS 정책 보안 점검 — 사용자 A가 만든 데이터를 사용자 B가 읽기/수정/삭제할 수 없는지,
// UI를 거치지 않고 PostgREST(Supabase REST API)를 직접 호출해 검증한다. 브라우저(page)가 필요 없어
// Playwright의 API 전용 `request` 픽스처만 사용.
//
// ⚠️ SUPABASE_URL/ANON_KEY는 의도적으로 하드코딩한다 — `apps/main/web/.env.local`에는 실제
// 클라우드 프로젝트(https://mzeokhamkbzdqpfcbpwh.supabase.co) 자격증명이 들어있고, Next.js dev
// 서버에서는 `.env.development.local`(로컬 인스턴스)이 우선하지만, 이 테스트는 Next.js를 거치지
// 않고 Supabase를 직접 호출하므로 env 로딩 순서에 기대지 않고 로컬 인스턴스 주소를 명시한다 —
// 실수로 클라우드 프로젝트에 테스트 계정/데이터를 만드는 사고를 원천 차단.
const SUPABASE_URL = "http://127.0.0.1:54321";
// Supabase CLI가 로컬 개발용으로 고정 발급하는 데모 anon key(비밀 아님, `supabase status` 출력과 동일).
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

interface Session {
  accessToken: string;
  userId: string;
}

async function signUp(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<Session> {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/signup`, {
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    data: { email, password },
  });
  expect(res.ok(), `signup 실패: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return { accessToken: body.access_token, userId: body.user.id };
}

function authHeaders(accessToken: string) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function insertOne(
  request: APIRequestContext,
  session: Session,
  table: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await request.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: { ...authHeaders(session.accessToken), Prefer: "return=representation" },
    data: payload,
  });
  expect(res.ok(), `${table} insert 실패: ${res.status()} ${await res.text()}`).toBeTruthy();
  const rows = await res.json();
  return rows[0];
}

async function selectById(
  request: APIRequestContext,
  session: Session,
  table: string,
  id: string
): Promise<unknown[]> {
  const res = await request.get(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    headers: authHeaders(session.accessToken),
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

// 회원가입 트리거가 자동 생성한 기본 지출분류(현금)/기본 지출항목 중 첫 행을 가져온다 — 별도 insert 없이
// FK(payment_method_id/category_id)로 재사용하고, 실제 컬럼값(name/display_name)도 함께 받아 뒤에서
// "타 사용자가 값을 바꿀 수 있는지" 검증의 기준값으로 쓴다.
async function selectFirst(
  request: APIRequestContext,
  session: Session,
  table: string,
  filter: string
): Promise<Record<string, unknown>> {
  const res = await request.get(`${SUPABASE_URL}/rest/v1/${table}?${filter}&select=*&limit=1`, {
    headers: authHeaders(session.accessToken),
  });
  expect(res.ok()).toBeTruthy();
  const [row] = await res.json();
  expect(
    row,
    `${table}에서 ${filter} 조건에 맞는 행을 찾지 못함(가입 트리거 확인 필요)`
  ).toBeTruthy();
  return row;
}

async function updateById(
  request: APIRequestContext,
  session: Session,
  table: string,
  id: string,
  patch: Record<string, unknown>
): Promise<unknown[]> {
  const res = await request.patch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    headers: { ...authHeaders(session.accessToken), Prefer: "return=representation" },
    data: patch,
  });
  expect(res.ok(), `${table} update 요청 자체가 실패: ${res.status()}`).toBeTruthy();
  return res.json();
}

async function deleteById(
  request: APIRequestContext,
  session: Session,
  table: string,
  id: string
): Promise<unknown[]> {
  const res = await request.delete(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    headers: { ...authHeaders(session.accessToken), Prefer: "return=representation" },
  });
  expect(res.ok(), `${table} delete 요청 자체가 실패: ${res.status()}`).toBeTruthy();
  return res.json();
}

function uniqueEmail(tag: string): string {
  return `rls_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test.describe("T-5-2 RLS 정책 — 타 사용자 데이터 접근 차단", () => {
  // SELECT/INSERT/UPDATE만 정책이 있고 DELETE 정책이 없는 테이블(소프트 비활성화만 지원) —
  // `데이터정책_및_시드정의서` 3장 표 그대로. 이 테이블들은 DELETE 자체를 아무도 못 하므로
  // "타 사용자 차단" 검증 대상에서 제외(전원 차단은 별개 속성이라 범위 밖).
  const noDeletePolicyTables = new Set(["category", "payment_method", "vendor", "item", "unit"]);

  test("사용자 A의 데이터를 사용자 B가 조회/수정/삭제할 수 없다 (9개 테이블)", async ({
    request,
  }) => {
    const userA = await signUp(request, uniqueEmail("a"), "testpass123!");
    const userB = await signUp(request, uniqueEmail("b"), "testpass123!");

    // 회원가입 트리거가 만들어준 기본 지출분류(현금)/지출항목을 그대로 재사용 — 별도 insert 불필요.
    const defaultPaymentMethod = await selectFirst(
      request,
      userA,
      "payment_method",
      "is_system_default=eq.true"
    );
    const defaultCategory = await selectFirst(
      request,
      userA,
      "category",
      "is_system_default=eq.true"
    );

    const vendorA = await insertOne(request, userA, "vendor", {
      user_id: userA.userId,
      name: "RLS테스트지출처",
    });
    const itemA = await insertOne(request, userA, "item", {
      user_id: userA.userId,
      name: "RLS테스트품목",
    });
    const unitA = await insertOne(request, userA, "unit", {
      user_id: userA.userId,
      name: "RLS테스트단위",
    });
    const transactionA = await insertOne(request, userA, "transaction", {
      user_id: userA.userId,
      payment_method_id: defaultPaymentMethod.id,
      category_id: defaultCategory.id,
      vendor_id: vendorA.id,
      input_type: "MANUAL",
      amount: 12345,
      occurred_at: new Date().toISOString(),
    });
    const detailA = await insertOne(request, userA, "transaction_detail", {
      transaction_id: transactionA.id,
      item_id: itemA.id,
      item_raw_text: "RLS테스트",
      amount: 5000,
    });
    const budgetA = await insertOne(request, userA, "budget", {
      user_id: userA.userId,
      category_id: defaultCategory.id,
      limit_amount: 100000,
      period: "2026-07",
    });
    const budgetTotalA = await insertOne(request, userA, "budget_total", {
      user_id: userA.userId,
      limit_amount: 500000,
      period: "2026-07",
    });

    // ownerCheckField/Value는 "이 값이 타 사용자의 UPDATE로 바뀌지 않았는지" 재확인할 실제 컬럼 —
    // id 컬럼(uuid) 자체를 넣으면 잘못된 형식 에러(400)와 RLS 차단(빈 결과)이 뒤섞여 버려 제외한다.
    const rows: { table: string; id: string; ownerCheckField: string; ownerCheckValue: unknown }[] =
      [
        {
          table: "category",
          id: defaultCategory.id as string,
          ownerCheckField: "name",
          ownerCheckValue: defaultCategory.name,
        },
        {
          table: "payment_method",
          id: defaultPaymentMethod.id as string,
          ownerCheckField: "display_name",
          ownerCheckValue: defaultPaymentMethod.display_name,
        },
        {
          table: "vendor",
          id: vendorA.id as string,
          ownerCheckField: "name",
          ownerCheckValue: "RLS테스트지출처",
        },
        {
          table: "item",
          id: itemA.id as string,
          ownerCheckField: "name",
          ownerCheckValue: "RLS테스트품목",
        },
        {
          table: "unit",
          id: unitA.id as string,
          ownerCheckField: "name",
          ownerCheckValue: "RLS테스트단위",
        },
        {
          table: "transaction",
          id: transactionA.id as string,
          ownerCheckField: "amount",
          ownerCheckValue: 12345,
        },
        {
          table: "transaction_detail",
          id: detailA.id as string,
          ownerCheckField: "item_raw_text",
          ownerCheckValue: "RLS테스트",
        },
        {
          table: "budget",
          id: budgetA.id as string,
          ownerCheckField: "limit_amount",
          ownerCheckValue: 100000,
        },
        {
          table: "budget_total",
          id: budgetTotalA.id as string,
          ownerCheckField: "limit_amount",
          ownerCheckValue: 500000,
        },
      ];

    for (const { table, id, ownerCheckField, ownerCheckValue } of rows) {
      // 1) 조회 차단: B가 A의 행을 select하면 RLS가 조용히 걸러내 빈 배열이 온다(권한 오류가 아님).
      const selected = await selectById(request, userB, table, id);
      expect(selected, `${table} SELECT가 타 사용자에게 노출됨`).toHaveLength(0);

      // 2) 수정 차단: B의 update는 매칭되는 행이 없어 빈 배열로 끝나고, 실제 값은 안 바뀐다.
      // 컬럼 타입에 맞는 "오염값"을 써야 RLS 차단(빈 결과)과 타입 에러(400)가 뒤섞이지 않는다.
      const poison =
        typeof ownerCheckValue === "number" ? (ownerCheckValue as number) + 999999 : "HACKED";
      const updated = await updateById(request, userB, table, id, { [ownerCheckField]: poison });
      expect(updated, `${table} UPDATE가 타 사용자에게 허용됨`).toHaveLength(0);
      const [afterUpdate] = await selectById(request, userA, table, id);
      expect(
        (afterUpdate as Record<string, unknown>)[ownerCheckField],
        `${table}의 실제 값이 타 사용자의 UPDATE로 변조됨`
      ).toBe(ownerCheckValue);

      // 3) 삭제 차단(DELETE 정책이 있는 테이블만 — 나머지는 애초에 아무도 삭제 불가).
      if (!noDeletePolicyTables.has(table)) {
        const deleted = await deleteById(request, userB, table, id);
        expect(deleted, `${table} DELETE가 타 사용자에게 허용됨`).toHaveLength(0);
        const stillThere = await selectById(request, userA, table, id);
        expect(stillThere, `${table}이 타 사용자의 DELETE로 실제 삭제됨`).toHaveLength(1);
      }
    }
  });
});

test.describe("T-5-2 RLS 정책 — 동의어 사전(운영자 전용, 전역 공유 테이블)", () => {
  test("일반 사용자는 조회는 되지만 등록/삭제는 차단된다", async ({ request }) => {
    const user = await signUp(request, uniqueEmail("syn"), "testpass123!");

    const readRes = await request.get(`${SUPABASE_URL}/rest/v1/synonym_dictionary?limit=1`, {
      headers: authHeaders(user.accessToken),
    });
    expect(readRes.ok(), "일반 사용자의 동의어 사전 조회(공개 자료)가 막힘").toBeTruthy();

    const writeRes = await request.post(`${SUPABASE_URL}/rest/v1/synonym_dictionary`, {
      headers: authHeaders(user.accessToken),
      data: { group_key: "RLS_TEST", term: "테스트" },
    });
    expect(
      writeRes.ok(),
      "일반 사용자가 동의어 사전에 쓰기를 할 수 있음(운영자 전용이어야 함)"
    ).toBeFalsy();
  });
});
