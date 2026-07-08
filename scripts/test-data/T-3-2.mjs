/**
 * T-3-2 캐시 갱신/무효화 테스트 시나리오 데이터
 * 단위 테스트: account-books/apps/main/web/__tests__/stats-cache.test.ts
 * E2E 테스트:  account-books/apps/main/web/e2e/cache-invalidation.spec.ts
 * S-3-6(item_top10 Redis 캐시)의 캐시 히트/미스 로직과, 지출 등록/삭제 시
 * invalidateItemTop10Cache가 실제로 낡은 값을 없애는지 검증.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-3-2",
  title: "캐시 갱신/무효화 테스트",
  unit: [
    {
      no: 1,
      category: "getItemTop10 — 캐시 히트",
      scenario:
        "캐시에 값이 있으면 RPC를 호출하지 않고 캐시된 값을 그대로 반환한다",
      input: "redis.get이 기존 Top10 배열을 반환하도록 모킹",
      expected: "supabase.rpc 미호출, 캐시값 그대로 반환",
    },
    {
      no: 2,
      category: "getItemTop10 — 캐시 미스",
      scenario:
        "캐시가 없으면 RPC로 계산한 뒤 상위 10개만 금액 내림차순으로 캐싱하고 반환한다",
      input: "redis.get이 null 반환, RPC가 12개 행 반환",
      expected:
        "결과 10개, 금액 내림차순 1위, redis.set이 TTL 300(5분)으로 호출됨",
    },
    {
      no: 3,
      category: "invalidateItemTop10Cache",
      scenario:
        "WBS에 명시된 키 형식(item_top10:{userId}:{period}) 그대로 삭제한다",
      input: 'userId: "user-42", period: "2026-08"',
      expected: 'redis.del("item_top10:user-42:2026-08") 호출',
    },
    {
      no: 4,
      category: "invalidateItemTop10Cache",
      scenario: "캐시에 없는 키를 지워도 예외 없이 끝난다(no-op)",
      input: "redis.del이 0(삭제된 키 없음) 반환",
      expected: "예외 없이 정상 종료",
    },
  ],
  e2e: [
    {
      no: 1,
      category: "F-3-1-3 상세항목 Top10 — 등록 시 무효화",
      scenario:
        "이미 캐시된 상태에서 같은 품목을 추가 등록하면, 재조회 시 낡은 값이 아니라 합산된 최신값이 보인다",
      precondition:
        "상세입력으로 감자(이마트 3,000원) 등록 후 홈 1회 진입(캐시 채움)한 계정",
      path: "/expenses/create → / → /expenses/create → /",
      expected:
        "캐시 무효화 없었다면 ₩3,000 그대로였을 것 — 실제로는 ₩5,000(3,000+2,000)으로 갱신",
    },
    {
      no: 2,
      category: "F-3-1-3 상세항목 Top10 — 삭제 시 무효화",
      scenario:
        "이미 캐시된 상태에서 지출을 삭제하면, 재조회 시 캐시가 아니라 삭제 반영된 최신 상태가 보인다",
      precondition:
        "상세입력으로 고구마(이마트 4,000원) 등록 후 홈 1회 진입(캐시 채움)한 계정",
      path: "/expenses/create → / → /expenses/calendar(삭제) → /",
      expected:
        "캐시 무효화 없었다면 '고구마'가 여전히 보였을 것 — 실제로는 사라지고 빈 상태 문구 표시",
    },
  ],
};
