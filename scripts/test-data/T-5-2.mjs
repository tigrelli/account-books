/**
 * T-5-2 RLS 정책 보안 점검 시나리오 데이터 (타 사용자 데이터 접근 차단 검증)
 * E2E 테스트: account-books/apps/main/web/e2e/rls-security.spec.ts
 * UI를 거치지 않고 PostgREST(Supabase REST API)를 사용자 A/B 세션으로 직접 호출해
 * DB 레벨 RLS 자체가 타 사용자 데이터를 막는지 검증. 브라우저 미사용, `supabase start`만 필요.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-5-2",
  title: "RLS 정책 보안 점검 (타 사용자 데이터 접근 차단 검증)",
  unit: [],
  e2e: [
    {
      no: 1,
      category: "타 사용자 데이터 접근 차단 (9개 테이블)",
      scenario:
        "사용자 A 소유 데이터를 사용자 B가 SELECT/UPDATE(/DELETE) 시도해도 차단된다",
      precondition:
        "사용자 A/B 각각 REST API로 신규 가입, A가 category/payment_method/vendor/item/unit/transaction/transaction_detail/budget/budget_total에 데이터 보유",
      path: "PostgREST 직접 호출 (REST API, UI 미경유)",
      expected:
        "B의 SELECT는 빈 배열(권한 오류 아님), UPDATE/DELETE도 매칭 0건 — A가 재조회하면 원본값/행 그대로 존재",
    },
    {
      no: 2,
      category: "동의어 사전(전역 공유, 운영자 전용 쓰기)",
      scenario: "일반 사용자는 조회는 되지만 등록은 차단된다",
      precondition: "일반(비운영자) 사용자 REST API로 신규 가입",
      path: "PostgREST 직접 호출 (REST API, UI 미경유)",
      expected: "조회 200 정상, 등록(POST)은 실패(GRANT 없음)",
    },
  ],
};
