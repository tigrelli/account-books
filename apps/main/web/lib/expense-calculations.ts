// 상세항목 금액(문자열) 합계 — Transaction.amount 자동계산(F-1-5-10)의 클라이언트 미리보기 계산식.
// 입력 도중의 빈 값/숫자 아닌 값은 0으로 취급해 타이핑 중에도 항상 안전하게 합계를 표시.
export function sumDetailAmounts(rows: { amount: string }[]): number {
  return rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}
