// 지출 수정 화면(F-1-5-x)이 목록(/expenses)의 어느 페이지/필터에서 진입했는지 기억해뒀다가
// "목록" 이동·저장/삭제 후 복귀 시 그 위치로 되돌리기 위한 헬퍼. 쿼리 파라미터(from)는 사용자가
// URL을 직접 조작할 수 있어 그대로 신뢰하면 오픈 리다이렉트가 될 수 있으므로, "/expenses"로
// 시작하는 내부 상대 경로일 때만 허용한다.
export function sanitizeExpenseListHref(from: string | undefined): string {
  if (!from) return "/expenses";
  if (!from.startsWith("/expenses")) return "/expenses";
  if (from.startsWith("//")) return "/expenses";
  return from;
}
