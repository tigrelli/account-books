/**
 * T-1-10-1 지출 내역 캘린더 뷰 E2E 테스트 시나리오 데이터 (백로그 B-7 채택, F-1-10-1~2)
 * E2E 테스트: account-books/apps/main/web/e2e/calendar.spec.ts
 * 월별 캘린더 그리드 조회(F-1-10-1) + 날짜 "+" 빠른 입력 레이어 팝업(F-1-10-2)이
 * 목록/토글, 월 이동, 팝업 저장→즉시 반영까지 정확히 동작하는지 검증.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-1-10-1",
  title:
    "캘린더 조회 + 빠른입력 E2E (월 이동, 일자별 표시, 팝업 저장 후 반영 확인)",
  unit: [],
  e2e: [
    {
      no: 1,
      category: "진입/토글",
      scenario: "지출 내역 목록에서 캘린더로 토글",
      precondition: "로그인한 계정",
      path: "/expenses → /expenses/calendar",
      expected: "월별 그리드(일~토 헤더) 표시",
    },
    {
      no: 2,
      category: "진입/토글",
      scenario: "캘린더에서 목록으로 다시 토글",
      precondition: "로그인한 계정",
      path: "/expenses/calendar → /expenses",
      expected: "목록 화면으로 이동",
    },
    {
      no: 3,
      category: "진입/토글",
      scenario: "이전 달/다음 달 이동",
      precondition: "로그인한 계정",
      path: "/expenses/calendar?period=2026-07",
      expected: "기간 표시와 URL의 period가 함께 바뀜",
    },
    {
      no: 4,
      category: "빠른 입력 팝업",
      scenario: "날짜 + 클릭 시 빠른 입력 팝업",
      precondition: "로그인한 계정",
      path: "/expenses/calendar",
      expected: "클릭한 날짜가 occurredAt 기본값으로 채워진 팝업 표시",
    },
    {
      no: 5,
      category: "빠른 입력 팝업",
      scenario: "팝업에서 저장 시 팝업이 닫히고 캘린더에 즉시 반영",
      precondition: "로그인한 계정",
      path: "/expenses/calendar",
      expected: "팝업 닫힘 + 새로고침 없이 해당 날짜 셀에 새 지출 반영",
    },
    {
      no: 6,
      category: "수정/삭제 팝업",
      scenario: "기존 지출 클릭 시 페이지 이동 없이 수정 팝업",
      precondition: "지출 1건 있는 계정",
      path: "/expenses/calendar",
      expected: "URL 그대로, 클릭한 지출 값이 채워진 '지출 수정' 팝업 표시",
    },
    {
      no: 7,
      category: "수정/삭제 팝업",
      scenario: "수정 팝업에서 저장 시 팝업이 닫히고 즉시 반영",
      precondition: "지출 1건 있는 계정",
      path: "/expenses/calendar",
      expected: "팝업 닫힘 + URL 그대로 + 수정된 금액이 캘린더에 반영",
    },
    {
      no: 8,
      category: "수정/삭제 팝업",
      scenario: "수정 팝업에서 삭제 시 팝업이 닫히고 캘린더에서 사라짐",
      precondition: "지출 1건 있는 계정",
      path: "/expenses/calendar",
      expected: "팝업 닫힘 + URL 그대로 + 해당 지출이 캘린더에서 제거",
    },
  ],
};
