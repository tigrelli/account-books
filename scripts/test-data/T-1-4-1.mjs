/**
 * T-1-4-1 마스터 데이터 CRUD 단위 테스트 시나리오 데이터
 * 단위 테스트: account-books/apps/main/web/__tests__/payment-method-schemas.test.ts
 * WBS 원 범위는 F-1-4-1~3 전체지만, F-1-4-2/F-1-4-3 화면 미구현으로
 * 이번엔 F-1-4-1(지출분류 관리)만 커버. 나머지는 해당 화면 구현 시 이어서 추가.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-1-4-1",
  title: "마스터 데이터 CRUD — 지출분류 관리 (F-1-4-1만 커버)",
  unit: [
    {
      no: 1,
      category: "표시명(계좌/현금) 스키마",
      scenario: "유효한 이름은 통과한다",
      input: 'displayName: "신한은행 통장"',
      expected: "success: true",
    },
    {
      no: 2,
      category: "표시명(계좌/현금) 스키마",
      scenario: "이름이 비어있으면 실패한다",
      input: 'displayName: ""',
      expected: "이름을 입력해 주세요",
    },
    {
      no: 3,
      category: "표시명(계좌/현금) 스키마",
      scenario: "이름이 50자를 초과하면 실패한다",
      input: "displayName: 51자",
      expected: "이름이 너무 깁니다",
    },
    {
      no: 4,
      category: "카드 스키마",
      scenario: "유효한 입력(CHECK)은 통과한다",
      input: 'displayName/cardIssuer 유효, cardKind: "CHECK"',
      expected: "success: true",
    },
    {
      no: 5,
      category: "카드 스키마",
      scenario: "유효한 입력(CREDIT)은 통과한다",
      input: 'cardKind: "CREDIT"',
      expected: "success: true",
    },
    {
      no: 6,
      category: "카드 스키마",
      scenario: "카드 별칭이 비어있으면 실패한다",
      input: 'displayName: ""',
      expected: "이름을 입력해 주세요",
    },
    {
      no: 7,
      category: "카드 스키마",
      scenario: "카드사가 비어있으면 실패한다",
      input: 'cardIssuer: ""',
      expected: "카드사를 입력해 주세요",
    },
    {
      no: 8,
      category: "카드 스키마",
      scenario: "카드사가 30자를 초과하면 실패한다",
      input: "cardIssuer: 31자",
      expected: "카드사명이 너무 깁니다",
    },
    {
      no: 9,
      category: "카드 스키마",
      scenario: "카드종류가 비어있으면 실패한다",
      input: 'cardKind: ""',
      expected: "카드 종류를 선택해 주세요",
    },
    {
      no: 10,
      category: "카드 스키마",
      scenario: "카드종류가 CHECK/CREDIT 외 값이면 실패한다",
      input: 'cardKind: "DEBIT"',
      expected: "success: false",
    },
  ],
  e2e: [],
};
