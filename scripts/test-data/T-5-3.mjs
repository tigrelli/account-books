/**
 * T-5-3 반응형 크로스 디바이스 점검 시나리오 데이터 (F-1-9-1)
 * E2E 테스트: account-books/apps/main/web/e2e/cross-device.spec.ts
 * T-5-1 responsive.spec.ts(모바일 드로어/데스크탑 사이드바 스모크)에 이어, 한 번도 검증된 적 없던
 * 태블릿 티어의 페이지네이션 크기 분기와, 3개 뷰포트(모바일/태블릿/데스크탑) × 앱 전체 13개
 * 라우트의 가로 스크롤 여부를 점검. 점검 중 발견한 `app/globals.css`의 의도치 않은 전역
 * `overflow-x: hidden`도 PM 확인 후 이번 세션에서 함께 제거.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-5-3",
  title: "반응형 크로스 디바이스 점검 (F-1-9-1)",
  unit: [],
  e2e: [
    {
      no: 1,
      category: "태블릿 페이지네이션",
      scenario:
        "태블릿(800px)/데스크탑(1280px)에서 지출 목록 페이지 크기(15건/20건)가 다르게 동작한다",
      precondition: "REST API로 지출 16건 보유한 계정",
      path: "/expenses",
      expected:
        '태블릿은 "1 / 2" + "다음" 버튼, 데스크탑은 "1 / 1" + "다음" 버튼 없음',
    },
    {
      no: 2,
      category: "가로 스크롤 없음 — 모바일(375px)",
      scenario: "전체 13개 라우트에 가로 스크롤이 생기지 않는다",
      precondition: "신규 가입 계정 + REST로 지출 1건(동적 라우트용)",
      path: "/signup, /login, /, /expenses, /expenses/create, /expenses/calendar, /expenses/[id]/edit, /budgets, /settings, /settings/{payment-methods,categories,vendors,items}",
      expected: "13개 라우트 모두 body.scrollWidth ≤ innerWidth",
    },
    {
      no: 3,
      category: "가로 스크롤 없음 — 태블릿(800px)",
      scenario: "전체 13개 라우트에 가로 스크롤이 생기지 않는다",
      precondition: "신규 가입 계정 + REST로 지출 1건(동적 라우트용)",
      path: "(위와 동일 13개 라우트)",
      expected: "13개 라우트 모두 body.scrollWidth ≤ innerWidth",
    },
    {
      no: 4,
      category: "가로 스크롤 없음 — 데스크탑(1280px)",
      scenario: "전체 13개 라우트에 가로 스크롤이 생기지 않는다",
      precondition: "신규 가입 계정 + REST로 지출 1건(동적 라우트용)",
      path: "(위와 동일 13개 라우트)",
      expected: "13개 라우트 모두 body.scrollWidth ≤ innerWidth",
    },
  ],
};
