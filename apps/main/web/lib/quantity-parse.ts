// 수량/단위 자유 텍스트 → 숫자+단위 구조화 시도 (아키텍처 1-1⑥).
// 성공: "1개"→{value:1, unitText:"개"}, "5"→{value:5, unitText:""}(단위 없이 수량만도 허용).
// 실패: 앞에 숫자가 없거나("한줌"), 단위 자리에 숫자/기호가 섞이면("1+1") null — 원본 텍스트만 보존.
// 클라이언트(미리보기, ExpenseEntryForm.tsx)와 서버 액션(실제 저장, actions.ts) 양쪽에서 사용.
export function parseQuantityText(raw: string): { value: number; unitText: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return null;

  const unitText = match[2]!.trim();
  if (unitText && !/^[a-zA-Z가-힣]+$/.test(unitText)) return null;

  return { value: Number(match[1]), unitText };
}
