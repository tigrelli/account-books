// [F-3-1-5] SYNONYM_DICTIONARY(운영자 전용) 접근 제어 — 이 앱엔 별도 운영자 role/테이블이
// 없어(데이터정책_및_시드정의서 3장 "1단계에서는 별도 운영자 role 없이..." 참고), 서버 전용
// 환경변수 ADMIN_EMAILS(쉼표 구분)에 등록된 이메일만 운영자로 취급한다. 클라이언트에 노출되면
// 안 되므로 NEXT_PUBLIC_ 접두사를 붙이지 않음 — 반드시 서버 컴포넌트/서버 액션에서만 호출.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}
