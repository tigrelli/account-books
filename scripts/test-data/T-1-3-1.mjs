/**
 * T-1-3-1 인증 테스트 시나리오 데이터
 * 단위 테스트: account-books/apps/main/web/__tests__/auth-schemas.test.ts
 * E2E 테스트:  account-books/apps/main/web/e2e/auth.spec.ts
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-1-3-1",
  title: "인증 — 회원가입 / 로그인 / 로그아웃",
  unit: [
    {
      no: 1,
      category: "회원가입 스키마",
      scenario: "유효한 입력은 통과한다",
      input: "이름·이메일·비밀번호·확인 모두 유효",
      expected: "success: true",
    },
    {
      no: 2,
      category: "회원가입 스키마",
      scenario: "이름이 비어있으면 실패한다",
      input: 'name: ""',
      expected: "이름을 입력해 주세요",
    },
    {
      no: 3,
      category: "회원가입 스키마",
      scenario: "이메일 형식이 잘못되면 실패한다",
      input: 'email: "not-an-email"',
      expected: "올바른 이메일 주소를 입력해 주세요",
    },
    {
      no: 4,
      category: "회원가입 스키마",
      scenario: "비밀번호가 8자 미만이면 실패한다",
      input: 'password: "short"',
      expected: "비밀번호는 8자 이상이어야 합니다",
    },
    {
      no: 5,
      category: "회원가입 스키마",
      scenario: "비밀번호 확인이 일치하지 않으면 실패한다",
      input: 'confirmPassword: "different"',
      expected: "비밀번호가 일치하지 않습니다",
    },
    {
      no: 6,
      category: "로그인 스키마",
      scenario: "유효한 입력은 통과한다",
      input: "이메일·비밀번호 모두 유효",
      expected: "success: true",
    },
    {
      no: 7,
      category: "로그인 스키마",
      scenario: "이메일 형식이 잘못되면 실패한다",
      input: 'email: "bad"',
      expected: "올바른 이메일 주소를 입력해 주세요",
    },
    {
      no: 8,
      category: "로그인 스키마",
      scenario: "비밀번호가 비어있으면 실패한다",
      input: 'password: ""',
      expected: "비밀번호를 입력해 주세요",
    },
    {
      no: 9,
      category: "프로필 스키마",
      scenario: "유효한 이름은 통과한다",
      input: 'name: "홍길동"',
      expected: "success: true",
    },
    {
      no: 10,
      category: "프로필 스키마",
      scenario: "이름이 비어있으면 실패한다",
      input: 'name: ""',
      expected: "이름을 입력해 주세요",
    },
    {
      no: 11,
      category: "비밀번호 변경 스키마",
      scenario: "유효한 입력은 통과한다",
      input: "newPassword·confirmPassword 모두 유효",
      expected: "success: true",
    },
    {
      no: 12,
      category: "비밀번호 변경 스키마",
      scenario: "새 비밀번호가 8자 미만이면 실패한다",
      input: 'newPassword: "short"',
      expected: "비밀번호는 8자 이상이어야 합니다",
    },
    {
      no: 13,
      category: "비밀번호 변경 스키마",
      scenario: "비밀번호 확인이 일치하지 않으면 실패한다",
      input: 'confirmPassword: "different"',
      expected: "비밀번호가 일치하지 않습니다",
    },
  ],
  e2e: [
    {
      no: 1,
      category: "회원가입",
      scenario: "유효한 정보로 회원가입하면 이메일 안내 화면이 표시된다",
      precondition: "앱 실행 중",
      path: "/signup",
      expected: '"이메일을 확인해 주세요" 화면 표시',
    },
    {
      no: 2,
      category: "회원가입",
      scenario: "이메일 형식이 잘못되면 필드 에러가 표시된다",
      precondition: "앱 실행 중",
      path: "/signup",
      expected: '"올바른 이메일 주소를 입력해 주세요" 에러 표시',
    },
    {
      no: 3,
      category: "회원가입",
      scenario: "비밀번호가 일치하지 않으면 필드 에러가 표시된다",
      precondition: "앱 실행 중",
      path: "/signup",
      expected: '"비밀번호가 일치하지 않습니다" 에러 표시',
    },
    {
      no: 4,
      category: "로그인",
      scenario: "잘못된 자격증명으로 로그인하면 에러 메시지가 표시된다",
      precondition: "앱 실행 중",
      path: "/login",
      expected: '"이메일 또는 비밀번호가 올바르지 않습니다" 에러 표시',
    },
    {
      no: 5,
      category: "로그인",
      scenario: "로그인하지 않고 보호된 경로 접근 시 로그인 페이지로 이동한다",
      precondition: "로그아웃 상태",
      path: "/settings",
      expected: "/login 으로 리디렉션",
    },
    {
      no: 6,
      category: "전체 흐름",
      scenario: "회원가입 후 로그인하고 로그아웃까지 완료된다",
      precondition: "앱 실행 중 / Supabase 로컬 실행",
      path: "/signup → /login → /settings",
      expected: "로그아웃 후 /login 으로 리디렉션",
    },
  ],
};
