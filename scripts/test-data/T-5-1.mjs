/**
 * T-5-1 전체 기능 회귀테스트 시나리오 데이터 (F-코드 전체 체크리스트, 서브앱 제외)
 * 단위 테스트: account-books/apps/main/web/__tests__/admin.test.ts
 * E2E 테스트: account-books/apps/main/web/e2e/{master-data,item-merge,budgets,admin-synonyms,expense-filters,responsive}.spec.ts
 * 완료된 F-코드(서브앱 F-1-2-x/F-2-x 제외) 중 자동화 테스트가 없던 영역(마스터데이터 CRUD,
 * 품목 병합, 예산, 동의어 사전 비인가 접근 차단, 지출 내역 필터, 반응형)을 새로 커버.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-5-1",
  title: "전체 기능 회귀테스트 (F-코드 전체 체크리스트, 서브앱 제외)",
  unit: [
    {
      no: 1,
      category: "운영자 판별(isAdminEmail)",
      scenario: "화이트리스트에 있는 이메일은 true를 반환한다",
      input: 'ADMIN_EMAILS="admin1@example.com,Admin2@Example.com"',
      expected: "true",
    },
    {
      no: 2,
      category: "운영자 판별(isAdminEmail)",
      scenario: "대소문자를 구분하지 않는다",
      input: "대문자로 변형한 이메일",
      expected: "true",
    },
    {
      no: 3,
      category: "운영자 판별(isAdminEmail)",
      scenario: "화이트리스트에 없는 이메일은 false를 반환한다",
      input: "nobody@example.com",
      expected: "false",
    },
    {
      no: 4,
      category: "운영자 판별(isAdminEmail)",
      scenario: "쉼표 뒤 공백을 트리밍하고 매칭한다",
      input: '"admin1@a.com, admin2@a.com"',
      expected: "둘 다 매칭",
    },
    {
      no: 5,
      category: "운영자 판별(isAdminEmail)",
      scenario: "null/undefined/빈 문자열은 false를 반환한다",
      input: "각각 전달",
      expected: "모두 false",
    },
    {
      no: 6,
      category: "운영자 판별(isAdminEmail)",
      scenario: "ADMIN_EMAILS가 설정되지 않으면 모든 이메일이 false다",
      input: "env 삭제 후 아무 이메일",
      expected: "false",
    },
  ],
  e2e: [
    {
      no: 1,
      category: "지출분류 관리 — 계좌 (F-1-4-1)",
      scenario: "등록 → 수정 → 비활성화 → 활성화",
      precondition: "신규 가입 계정",
      path: "/settings/payment-methods",
      expected: "각 단계가 화면에 즉시 반영된다",
    },
    {
      no: 2,
      category: "지출분류 관리 — 카드 (F-1-4-1)",
      scenario: "등록 → 수정 → 비활성화",
      precondition: "신규 가입 계정",
      path: "/settings/payment-methods",
      expected: "각 단계가 화면에 즉시 반영된다",
    },
    {
      no: 3,
      category: "지출항목 관리 (F-1-4-2)",
      scenario: "등록 → 수정 → 비활성화 → 활성화",
      precondition: "신규 가입 계정",
      path: "/settings/categories",
      expected: "각 단계가 화면에 즉시 반영된다",
    },
    {
      no: 4,
      category: "지출처 관리 (F-1-4-3)",
      scenario: "등록 → 수정 → 비활성화 → 활성화",
      precondition: "신규 가입 계정",
      path: "/settings/vendors",
      expected: "각 단계가 화면에 즉시 반영된다",
    },
    {
      no: 5,
      category: "품목 목록/별칭 (F-1-6-1~2)",
      scenario: "상세입력으로 등록한 품목이 목록에 뜨고 별칭을 추가할 수 있다",
      precondition: "상세입력으로 '당근' 등록한 계정",
      path: "/settings/items",
      expected: "목록에 품목명 표시, 별칭 태그 추가됨",
    },
    {
      no: 6,
      category: "품목 수동 병합 (F-1-6-3)",
      scenario:
        "한 품목을 다른 품목으로 병합하면 목록에서 사라지고 별칭으로 흡수된다",
      precondition: "'감자'/'고구마' 상세입력으로 각각 등록한 계정",
      path: "/settings/items",
      expected: "감자는 이름(<p>)으로 더는 없고, 고구마의 별칭으로 흡수됨",
    },
    {
      no: 7,
      category: "예산 설정 + 소진율 게이지 (F-1-7-1~2)",
      scenario:
        "전체/카테고리 예산 등록 후 그 카테고리에 지출을 넣으면 정확한 소진율이 표시된다",
      precondition:
        "전체예산 100,000원/카테고리예산 50,000원 등록 후 25,000원 지출 등록",
      path: "/budgets",
      expected: "25,000원 / 50,000원 · 50% 표시",
    },
    {
      no: 8,
      category: "예산 리셋 (F-1-7-1)",
      scenario:
        "리셋 확인 팝업에서 확인하면 예산이 즉시 0으로 초기화되고 게이지가 사라진다",
      precondition: "예산이 등록된 계정",
      path: "/budgets",
      expected: "확인 즉시 0으로 초기화, 게이지 소멸",
    },
    {
      no: 9,
      category: "동의어 사전 관리 — 비인가 접근 차단 (F-3-1-5)",
      scenario: "일반 사용자에게는 사이드바에 메뉴가 보이지 않는다",
      precondition: "일반(비운영자) 신규 가입 계정",
      path: "/",
      expected: "'동의어 사전 관리' 링크 없음",
    },
    {
      no: 10,
      category: "동의어 사전 관리 — 비인가 접근 차단 (F-3-1-5)",
      scenario:
        "일반 사용자가 URL을 직접 입력해 접근을 시도해도 홈으로 리다이렉트된다",
      precondition: "일반(비운영자) 신규 가입 계정",
      path: "/admin/synonyms",
      expected: "/ 로 리다이렉트",
    },
    {
      no: 11,
      category: "지출 내역 필터 (F-1-1-11)",
      scenario:
        "지출항목으로 필터링하면 해당 항목만 보이고, 초기화하면 전체가 다시 보인다",
      precondition: "서로 다른 지출항목으로 2건 등록한 계정",
      path: "/expenses",
      expected: "필터 적용 시 해당 항목만 표시, 초기화 시 전체 복원",
    },
    {
      no: 12,
      category: "지출 내역 필터 (F-1-1-11)",
      scenario:
        "조건에 맞는 지출이 없으면 빈 상태 문구와 필터 초기화 링크가 표시된다",
      precondition: "미래 날짜로 시작일 필터 적용",
      path: "/expenses",
      expected: "빈 상태 문구 + '필터 초기화' 링크 표시",
    },
    {
      no: 13,
      category: "반응형 — 모바일 (F-1-9-1)",
      scenario:
        "햄버거 메뉴로 드로어를 열고 항목을 눌러 이동하면 드로어가 닫힌다",
      precondition: "375×667 뷰포트",
      path: "/",
      expected: "드로어 오픈/네비게이션/자동 닫힘 정상",
    },
    {
      no: 14,
      category: "반응형 — 데스크탑 (F-1-9-1)",
      scenario: "고정 사이드바가 보이고 햄버거 메뉴는 없다",
      precondition: "기본(데스크탑) 뷰포트",
      path: "/",
      expected: "사이드바 노출, 햄버거 버튼 없음",
    },
  ],
};
