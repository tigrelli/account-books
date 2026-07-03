/**
 * T-1-8-1 대시보드 화면 E2E 테스트 시나리오 데이터 (데이터 입력 후 반영 확인)
 * E2E 테스트: account-books/apps/main/web/e2e/dashboard.spec.ts
 * F-1-8-1~3(요약카드/월별추이/카테고리별) + F-3-1-1(지출분류별, 홈 위젯) 전체가
 * 지출 입력 직후 대시보드에 정확히 반영되는지 검증.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-1-8-1",
  title: "대시보드 화면 E2E (데이터 입력 후 반영 확인)",
  unit: [],
  e2e: [
    {
      no: 1,
      category: "빈 상태",
      scenario: "신규 가입 직후(지출 내역 없음) 대시보드 진입",
      precondition: "지출 내역 없는 신규 가입 계정",
      path: "/",
      expected:
        "이번달 총지출 ₩0, 비교할 전월 데이터 없음, 3개 차트 모두 빈 상태 문구",
    },
    {
      no: 2,
      category: "반영 확인",
      scenario: "지출 1건 입력 후 이번달 총지출 반영",
      precondition: "지출분류/지출항목 자동 생성된 신규 가입 계정",
      path: "/expenses/create → /",
      expected: "이번달 총지출에 입력 금액(₩15,000) 반영",
    },
    {
      no: 3,
      category: "반영 확인",
      scenario: "지출 1건 입력 후 카테고리별/지출분류별 차트 반영",
      precondition: "지출분류/지출항목 자동 생성된 신규 가입 계정",
      path: "/expenses/create → /",
      expected: "빈 상태 문구 사라짐, 두 차트 모두 100% 단일 항목 표시",
    },
    {
      no: 4,
      category: "반영 확인",
      scenario: "지출 2건 입력 시 이번달 총지출 누적 합산",
      precondition: "지출분류/지출항목 자동 생성된 신규 가입 계정",
      path: "/expenses/create ×2 → /",
      expected: "두 건 합계(₩15,000+₩3,000=₩18,000)로 누적 표시",
    },
  ],
};
