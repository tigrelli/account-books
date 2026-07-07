/**
 * T-3-1 통계 정확도 검증 시나리오 데이터 (MV 결과와 수동 계산값 비교)
 * E2E 테스트: account-books/apps/main/web/e2e/stats-accuracy.spec.ts
 * F-3-1-1(지출분류별)~F-3-1-4(단가 분석)가 실제 등록한 지출로부터 수동 계산한
 * 값(합계/평균단가/퍼센트)과 정확히 일치하는지, 실 UI를 통해 검증.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-3-1",
  title: "통계 정확도 검증 (MV 결과와 수동 계산값 비교)",
  unit: [],
  e2e: [
    {
      no: 1,
      category: "지출처 Top 10 (F-3-1-2)",
      scenario:
        "서로 다른 지출처 3곳(3만/2만/1만원)의 금액이 내림차순으로 정확히 표시된다",
      precondition: "지출처 3곳에 각 1건씩 등록한 계정",
      path: "/expenses/create ×3 → /",
      expected: "지출처 Top 10에 ₩30,000/₩20,000/₩10,000이 내림차순으로 표시",
    },
    {
      no: 2,
      category: "상세항목 Top 10 + 드릴다운 (F-3-1-3)",
      scenario:
        "같은 품목을 여러 지출처에서 구매하면 합계가 정확히 집계되고 드릴다운도 지출처별로 분리된다",
      precondition:
        "같은 품목(양파)을 지출처 2곳에서 각각 상세입력으로 등록한 계정",
      path: "/expenses/create ×2 → /",
      expected:
        "상세항목 Top10에 합계(₩8,000), 클릭 시 이마트 ₩5,000/쿠팡 ₩3,000으로 분리 표시",
    },
    {
      no: 3,
      category: "단가 분석 (F-3-1-4)",
      scenario: "수량/금액으로 계산한 평균단가가 툴팁에 정확히 표시된다",
      precondition: "당근 2kg을 4,000원에 상세입력으로 등록한 계정",
      path: "/expenses/create → /",
      expected: "단가 분석 그래프 dot hover 시 툴팁에 '₩2,000 / kg' 표시",
    },
    {
      no: 4,
      category: "지출분류별 (F-3-1-1)",
      scenario: "현금과 신용카드 지출 비율이 수동 계산한 퍼센트와 일치한다",
      precondition:
        "신용카드 1개 등록 후 현금 15,000원/카드 5,000원 각 1건씩 등록한 계정",
      path: "/settings/payment-methods → /expenses/create ×2 → /",
      expected:
        "지출분류별 위젯에 '현금 ₩15,000 · 75%' / '카드 ₩5,000 · 25%' 표시",
    },
  ],
};
