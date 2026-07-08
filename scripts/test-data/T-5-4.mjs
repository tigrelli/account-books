/**
 * T-5-4 성능 점검 시나리오 데이터 (대시보드 응답속도, MV/캐시 효과 확인)
 * E2E 테스트: account-books/apps/main/web/e2e/performance.spec.ts (상시 회귀 가드 — 응답 예산 5초)
 * MV/캐시 정밀 효과 측정(EXPLAIN ANALYZE, Redis 직접 호출)은 대량 시딩이 필요한 일회성
 * 벤치마크로 수행하고 커밋하지 않음 — 수치 결과는 docs/test-scenarios.md T-5-4 절 참고.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-5-4",
  title: "성능 점검 (대시보드 응답속도, MV/캐시 효과 확인)",
  unit: [],
  e2e: [
    {
      no: 1,
      category: "대시보드 응답 시간 예산",
      scenario:
        "신규 계정으로 대시보드 최초 진입 + 재방문 각각 로드 시간을 측정한다",
      precondition: "신규 가입 계정",
      path: "/",
      expected: "최초 진입/재방문 모두 5,000ms 예산 안에 완료",
    },
  ],
};
