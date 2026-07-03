/**
 * T-1-4-1 마스터 데이터 CRUD 단위 테스트 시나리오 데이터
 * 단위 테스트: account-books/apps/main/web/__tests__/{payment-method,category,vendor}-schemas.test.ts
 * WBS 원 범위 F-1-4-1~3(지출분류/지출항목/지출처 관리) 전체 커버 완료.
 *
 * 2026-07-03 정정 1: 카드 등록 폼의 "카드 별칭"+"카드사" 두 입력을 "카드사명" 한 칸으로 통합(PM 결정).
 * cardSchema에서 cardIssuer 필드 자체를 제거 — card_issuer DB 컬럼은 삭제하지 않고 항상 null로 저장.
 * 기존 카드사 관련 시나리오(빈 값 통과/30자 초과 실패)는 더 이상 유효하지 않아 제거, 번호 재정렬.
 *
 * 2026-07-03 정정 2: 지출처(vendor)는 여러 카테고리 지출이 섞일 수 있어(예: GS슈퍼에서 식료품+의류) 기본
 * 카테고리 추천(defaultCategoryId) 필드도 vendorSchema에서 제거 — default_category_id 컬럼은 유지하되
 * 항상 null. 기존 "이름+기본카테고리"/"기본카테고리 없이 이름만" 두 시나리오를 "유효한 이름" 하나로 통합.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-1-4-1",
  title: "마스터 데이터 CRUD — 지출분류/지출항목/지출처 관리 (F-1-4-1~3 전체)",
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
      input: 'displayName: "국민카드", cardKind: "CHECK"',
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
      scenario: "카드사명이 비어있으면 실패한다",
      input: 'displayName: ""',
      expected: "이름을 입력해 주세요",
    },
    {
      no: 7,
      category: "카드 스키마",
      scenario: "카드종류가 비어있으면 실패한다",
      input: 'cardKind: ""',
      expected: "카드 종류를 선택해 주세요",
    },
    {
      no: 8,
      category: "카드 스키마",
      scenario: "카드종류가 CHECK/CREDIT 외 값이면 실패한다",
      input: 'cardKind: "DEBIT"',
      expected: "success: false",
    },
    {
      no: 9,
      category: "지출항목 스키마",
      scenario: "유효한 입력(이름+아이콘)은 통과한다",
      input: 'name: "외식", icon: "🍔"',
      expected: "success: true",
    },
    {
      no: 10,
      category: "지출항목 스키마",
      scenario: "아이콘 없이 이름만 있어도 통과한다",
      input: 'name: "외식"',
      expected: "success: true",
    },
    {
      no: 11,
      category: "지출항목 스키마",
      scenario: "이름이 비어있으면 실패한다",
      input: 'name: ""',
      expected: "이름을 입력해 주세요",
    },
    {
      no: 12,
      category: "지출항목 스키마",
      scenario: "이름이 30자를 초과하면 실패한다",
      input: "name: 31자",
      expected: "이름이 너무 깁니다",
    },
    {
      no: 13,
      category: "지출항목 스키마",
      scenario: "아이콘이 10자를 초과하면 실패한다",
      input: "icon: 11자",
      expected: "아이콘은 짧은 이모지 1개만 입력해 주세요",
    },
    {
      no: 14,
      category: "지출처 스키마",
      scenario: "유효한 이름은 통과한다(2026-07-03: 기본 카테고리 필드 제거)",
      input: 'name: "이마트"',
      expected: "success: true",
    },
    {
      no: 15,
      category: "지출처 스키마",
      scenario: "이름이 비어있으면 실패한다",
      input: 'name: ""',
      expected: "이름을 입력해 주세요",
    },
    {
      no: 16,
      category: "지출처 스키마",
      scenario: "이름이 50자를 초과하면 실패한다",
      input: "name: 51자",
      expected: "이름이 너무 깁니다",
    },
  ],
  e2e: [],
};
