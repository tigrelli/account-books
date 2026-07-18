/**
 * T-2-2 항목 선정 E2E 테스트 시나리오 데이터
 * 단위 테스트: account-books/apps/main/web/__tests__/utility-bill-actions.test.ts
 *   (deactivateUnselectedUtilityBillItemsAction, F-2-2-2에서 구현과 함께 작성)
 * E2E 테스트:  account-books/apps/main/web/e2e/utility-bill-upload.spec.ts
 * 최초 업로드(활성 UTILITY_BILL_ITEM 0개 → 매칭률 0%) → 항목 선정 화면 → 최소 1개
 * 검증 → 선택한 항목만 저장 → 결제수단 확정 → 확인 화면 → 최종 저장까지 전체 경로.
 * OCR은 유료 Google Vision API 대신 결정적 fixture provider(lib/ocr/fixture-provider.ts,
 * OCR_PROVIDER=fixture)를 사용 — playwright.config.ts의 webServer.env에서만 설정.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-2-2",
  title: "항목 선정 E2E",
  unit: [
    {
      no: 1,
      category: "deactivateUnselectedUtilityBillItemsAction",
      scenario: "선택된 라벨과 일치하는 항목은 비활성화하지 않는다",
      input:
        '활성 항목 source_labels: ["일반관리비"], 선택 라벨 ["일반관리비"]',
      expected: "utility_bill_item UPDATE 없음",
    },
    {
      no: 2,
      category: "deactivateUnselectedUtilityBillItemsAction",
      scenario: "선택되지 않은 기존 활성 항목은 is_active=false로 전환한다",
      input:
        '활성 항목 source_labels: ["정화조오물수수료"], 선택 라벨 ["일반관리비"]',
      expected: 'UPDATE { is_active: false } + .in("id", ["item-2"]) 호출',
    },
    {
      no: 3,
      category: "deactivateUnselectedUtilityBillItemsAction",
      scenario:
        "공백 차이만 있는 라벨은 같은 항목으로 보고 비활성화하지 않는다",
      input:
        '활성 항목 source_labels: ["일반 관리비"], 선택 라벨 ["일반관리비"]',
      expected: "UPDATE 없음",
    },
    {
      no: 4,
      category: "deactivateUnselectedUtilityBillItemsAction",
      scenario: "활성 항목이 없으면 아무것도 하지 않는다",
      input: "활성 utility_bill_item 0건",
      expected: "UPDATE 없음",
    },
  ],
  e2e: [
    {
      no: 1,
      category: "최초 업로드 → 항목 선정 화면",
      scenario:
        "신규 계정(활성 항목 0개)으로 업로드하면 항목 선정 화면으로 진입한다",
      precondition: "회원가입 직후 계정, 활성 UTILITY_BILL_ITEM 0개",
      path: "/utility-bills/upload → 사진 업로드",
      expected:
        '/utility-bills/upload/items로 리다이렉트, 체크박스 4개, "사용량 연결됨" 배지 노출',
    },
    {
      no: 2,
      category: "최소 1개 선택 검증(F-2-2-2)",
      scenario: "체크박스를 전체 해제하면 저장이 막힌다",
      precondition: "항목 선정 화면 진입 상태",
      path: "체크박스 전체 해제",
      expected: '"최소 1개 이상 선택해주세요" 안내 + 저장 버튼 비활성화',
    },
    {
      no: 3,
      category: "항목 선정 → 저장 → 확인 화면 → 최종 저장",
      scenario:
        "일부 항목만 선택해 저장하면 확인 화면에 선택된 항목만 반영되고 지출로 등록된다",
      precondition: '"소독비" 체크박스만 해제한 상태',
      path: "선택한 항목으로 저장 → 결제수단 선택 확인 → 확인 화면 → 저장 → 성공 팝업 확인",
      expected:
        '확인 화면에 "소독비"는 없고 나머지 항목만 표시, /expenses에 "관리사무소" 지출로 정상 반영',
    },
  ],
};
