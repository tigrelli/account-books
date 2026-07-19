/**
 * T-2-3 관리비 명세서 통계 화면 단위테스트 시나리오 데이터
 * 단위 테스트: account-books/apps/main/web/__tests__/utility-bill-stats-queries.test.ts
 * F-2-3-1~3-3(총액 추이 / 항목별 추이 / 전월대비 증감률+비중 도넛)의 집계 함수
 * (getUtilityBillTotalTrend, getUtilityBillItemTrend, getUtilityBillChangeRate,
 * getUtilityBillLatestItemBreakdown)가 올바르게 동작하는지 검증.
 * "이번 달/전월"·"올해/미래 연도" 분기는 vi.setSystemTime()으로 기준일(2026-07-18)을
 * 고정해 검증.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-2-3",
  title: "관리비 명세서 통계 화면 단위테스트",
  unit: [
    {
      no: 1,
      category: "getUtilityBillTotalTrend",
      scenario: "과거 연도는 12개월 전부 반환하고 미등록 달은 0원으로 채운다",
      input: "2025년 중 2개월만 데이터 존재(UPLOAD/MANUAL 각 1건)",
      expected:
        "12개월 반환, 미등록 달은 {total:0, isManual:false}, MANUAL 달은 isManual:true",
    },
    {
      no: 2,
      category: "getUtilityBillTotalTrend",
      scenario: "올해는 이번 달까지만, 미래 연도는 빈 배열을 반환한다",
      input: "기준일 2026-07-18, 연도 파라미터 2026/2027",
      expected: "2026년은 7개월(1~7월), 2027년은 빈 배열",
    },
    {
      no: 3,
      category: "getUtilityBillItemTrend",
      scenario: "활성 항목이 없으면 빈 결과를 반환한다",
      input: "활성 utility_bill_item 0건",
      expected: "{items:[], points:[], totalActiveItemCount:0}",
    },
    {
      no: 4,
      category: "getUtilityBillItemTrend",
      scenario: "값이 없는 항목/달은 0이 아니라 null로 둔다",
      input: "항목 2개 중 1개만 특정 달에 값 존재",
      expected: "값 있는 항목은 금액, 없는 항목/달은 null",
    },
    {
      no: 5,
      category: "getUtilityBillItemTrend",
      scenario: "활성 항목 5개 초과 시 최근 3개월 변화폭 상위 5개만 반환한다",
      input: "활성 항목 6개, 1개만 최근 3개월 변화폭 큼(100원→10,000원)",
      expected: "상위 5개만 반환, 변화폭 큰 항목 포함",
    },
    {
      no: 6,
      category: "getUtilityBillChangeRate",
      scenario: "이번 달/전월 총액과 증감률을 계산한다",
      input: "기준일 2026-07-18, 전월 100,000원 → 이번달 130,000원",
      expected: "changeRate: 0.3",
    },
    {
      no: 7,
      category: "getUtilityBillChangeRate",
      scenario: "이번 달 또는 전월 데이터가 없으면 changeRate는 null이다",
      input: "전월 레코드 없음",
      expected: "previousTotal: null, changeRate: null",
    },
    {
      no: 8,
      category: "getUtilityBillChangeRate",
      scenario: "전월 총액이 0이면 나눗셈이 무의미해 changeRate는 null이다",
      input: "전월 amount: 0",
      expected: "changeRate: null",
    },
    {
      no: 9,
      category: "getUtilityBillLatestItemBreakdown",
      scenario: "이번 달 등록이 없으면 빈 배열을 반환한다",
      input: "해당 청구월 utility_bill_record 없음",
      expected: "빈 배열",
    },
    {
      no: 10,
      category: "getUtilityBillLatestItemBreakdown",
      scenario: "이번 달 항목별 비중을 금액 내림차순으로 반환한다",
      input: "항목 2개(10,000원/50,000원)",
      expected: "금액 내림차순 정렬",
    },
  ],
  e2e: [],
};
