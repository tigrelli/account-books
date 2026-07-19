/**
 * T-2-1 관리비 명세서 업로드 플로우 단위테스트 시나리오 데이터
 * 단위 테스트: account-books/apps/main/web/__tests__/utility-bill-actions.test.ts
 * F-2-1-1~3(업로드 화면 골격 → 재업로드 충돌 판정 → 확인/저장)의 서버 액션
 * (checkPeriodConflictAction, saveUtilityBillAction)이 최초/재업로드-동일형식/
 * 재업로드-형식변경 3케이스에서 올바르게 동작하는지 검증.
 * 범위: S-2-9 형식변경 판정 함수는 아직 실제 플로우에 연동되지 않아(백로그 B-13),
 * "형식변경"은 UTILITY_BILL_ITEM 라벨 upsert(신규 생성 vs 재사용) 분기로 검증.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-2-1",
  title: "관리비 명세서 업로드 플로우 단위테스트",
  unit: [
    {
      no: 1,
      category: "checkPeriodConflictAction",
      scenario: "해당 청구월에 기존 등록이 없으면 최초 업로드로 판정한다",
      input: "utility_bill_record 없음",
      expected: 'status: "none"',
    },
    {
      no: 2,
      category: "checkPeriodConflictAction",
      scenario: "기존 등록이 수동 입력(MANUAL)이면 업로드를 차단한다(케이스 A)",
      input: 'source: "MANUAL"인 기존 레코드',
      expected: 'status: "blocked"',
    },
    {
      no: 3,
      category: "checkPeriodConflictAction",
      scenario:
        "기존 등록이 업로드(UPLOAD)면 재업로드 확인이 필요하다(케이스 B)",
      input: 'source: "UPLOAD"인 기존 레코드',
      expected: 'status: "confirm_needed"',
    },
    {
      no: 4,
      category: "saveUtilityBillAction — 최초 업로드",
      scenario: "지출처/항목이 없으면 새로 만들고 저장한다",
      input: "지출처·UTILITY_BILL_ITEM 미존재, replaceExisting: false",
      expected:
        "성공, vendor/utility_bill_item 각 1건 신규 INSERT, transaction DELETE 없음",
    },
    {
      no: 5,
      category: "saveUtilityBillAction — 재업로드-동일형식",
      scenario:
        "같은 라벨이 이미 있으면 UTILITY_BILL_ITEM을 새로 만들지 않고 재사용한다",
      input: '라벨 "일반관리비" 기존과 동일, replaceExisting: true',
      expected:
        "성공, 기존 transaction 1건 DELETE, vendor/utility_bill_item 신규 INSERT 없음",
    },
    {
      no: 6,
      category: "saveUtilityBillAction — 재업로드-형식변경",
      scenario: "처음 보는 라벨이면 UTILITY_BILL_ITEM을 새로 만든다",
      input: '라벨 "정화조오물수수료"(신규), replaceExisting: true',
      expected:
        "성공, 기존 transaction DELETE + 새 라벨로 utility_bill_item 1건 신규 INSERT",
    },
    {
      no: 7,
      category: "saveUtilityBillAction — 예외",
      scenario: '"관리비/공과금" 카테고리가 없으면 에러를 반환한다',
      input: "category 조회 결과 없음",
      expected: "관리비/공과금 카테고리를 찾을 수 없습니다",
    },
    {
      no: 8,
      category: "saveUtilityBillAction — 예외",
      scenario: "필수 필드가 없으면 에러를 반환한다",
      input: "paymentMethodId/occurredAt/file 누락",
      expected: "잘못된 요청입니다",
    },
    {
      no: 9,
      category: "saveUtilityBillAction — 예외",
      scenario: "extraction JSON이 깨져 있으면 에러를 반환한다",
      input: 'extraction: "{ not json"',
      expected: "잘못된 요청입니다",
    },
  ],
  e2e: [],
};
