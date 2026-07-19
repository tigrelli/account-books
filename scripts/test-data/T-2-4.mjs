/**
 * T-2-4 관리비 전체 E2E 테스트 시나리오 데이터
 * E2E 테스트: account-books/apps/main/web/e2e/utility-bill-full-flow.spec.ts
 * 업로드→항목 선정(T-2-2와 동일 경로)→통계 화면 불일치 알림(F-2-4-2)→메인 지출
 * 수정 안내/저장 팝업(F-2-4-1)→수정 후 통계 화면 불일치 알림 갱신까지 하나의
 * 흐름으로 검증하는 통합 E2E.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-2-4",
  title: "관리비 전체 E2E",
  unit: [],
  e2e: [
    {
      no: 1,
      category: "업로드 → 항목 선정 (T-2-2와 동일)",
      scenario:
        "신규 계정으로 업로드 후 소독비를 해제해 저장하면 지출로 등록된다",
      precondition: "회원가입 직후 계정, 활성 UTILITY_BILL_ITEM 0개",
      path: "사진 업로드 → 항목 선정(소독비 해제) → 결제수단 선택 → 확인 화면 → 저장",
      expected: "/expenses에 관리사무소 지출로 정상 반영",
    },
    {
      no: 2,
      category: "통계 화면 최초 불일치 알림(F-2-4-2)",
      scenario: "지정 항목 합계와 총액이 다르면 통계 화면에 불일치 알림이 뜬다",
      precondition: "소독비를 제외하고 저장한 직후",
      path: "/utility-bills/stats → 총액 불일치 클릭",
      expected:
        "팝업에 실제 등록 금액 165,600원, 지정 항목 합계는 그보다 작은 값",
    },
    {
      no: 3,
      category: "지출 수정 안내 아이콘(F-2-4-1)",
      scenario: "관리비 명세서로 등록된 지출의 수정 화면엔 안내 아이콘이 있다",
      precondition: "위에서 등록한 지출",
      path: "/expenses에서 해당 지출 클릭 → 수정 화면 진입",
      expected: "안내 아이콘 노출, 클릭 시 펼침, 재클릭 시 접힘",
    },
    {
      no: 4,
      category: "금액 수정 시 안내 팝업(F-2-4-1)",
      scenario:
        "금액을 실제로 수정해 저장하면 안내 팝업이 뜨고, 확인해야 이동한다",
      precondition: "수정 화면에서 금액을 170,000원으로 변경",
      path: '"수정" 버튼 클릭',
      expected: "안내 팝업 노출(확인 전엔 이동 안 함), 확인 후 목록으로 이동",
    },
    {
      no: 5,
      category: "통계 화면 불일치 알림 갱신(F-2-4-2)",
      scenario:
        "메인에서 수정한 금액이 통계 화면 불일치 알림에 그대로 반영된다",
      precondition: "금액을 170,000원으로 수정 저장한 직후",
      path: "/utility-bills/stats → 총액 불일치 클릭",
      expected: "실제 등록 금액이 170,000원으로 갱신, 지정 항목 합계는 그대로",
    },
  ],
};
