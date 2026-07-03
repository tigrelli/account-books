/**
 * T-1-5-2 지출 입력 E2E 테스트(직접입력/상세입력 두 경로) 시나리오 데이터
 * 이 샌드박스 환경엔 헤드리스 브라우저 구동용 시스템 라이브러리가 없어 Playwright 자동화 불가
 * (T-1-3-1/T-1-4-1과 동일 제약) — PM이 로컬 dev 서버에서 아래 경로를 수동 검증하고 완료 처리.
 * 자동화된 Playwright 스펙 작성은 docs/백로그.md B-6 참고.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-1-5-2",
  title: "지출 입력 E2E 테스트 (직접입력/상세입력 두 경로) — 수동 검증",
  unit: [],
  e2e: [
    {
      no: 1,
      category: "직접입력",
      scenario: "직접입력 모드로 지출 저장",
      precondition: "로그인 상태, 지출분류/지출항목 1개 이상 등록됨",
      path: "/expenses/create",
      expected: "목록(/expenses)에 즉시 반영",
    },
    {
      no: 2,
      category: "상세입력",
      scenario: "상세입력 모드로 지출 저장(품목 여러 건)",
      precondition: "로그인 상태",
      path: "/expenses/create",
      expected: "상세항목 합계가 Transaction.amount로 저장",
    },
    {
      no: 3,
      category: "수정",
      scenario: "저장된 지출 수정(직접입력 ↔ 상세입력 모드 전환 포함)",
      precondition: "지출 내역 1건 이상 존재",
      path: "/expenses/[id]/edit",
      expected: "수정 후 목록에 반영, 상세행 정합성 유지",
    },
    {
      no: 4,
      category: "삭제",
      scenario: "저장된 지출 삭제",
      precondition: "지출 내역 1건 이상 존재",
      path: "/expenses/[id]/edit",
      expected: "삭제 확인 후 목록에서 사라짐",
    },
    {
      no: 5,
      category: "필터",
      scenario: "지출 내역 필터(기간/지출분류/지출항목/지출처)",
      precondition: "지출 내역 여러 건 존재",
      path: "/expenses",
      expected: "조건에 맞는 항목만 표시",
    },
  ],
};
