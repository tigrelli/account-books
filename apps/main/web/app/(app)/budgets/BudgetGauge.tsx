// 예산 소진율 게이지(F-1-7-2) — 예산이 설정된 경우에만 표시. 트랙 색상은 DESIGN_GUIDE의
// "잔여 예산 바" 용도인 --paylens-data-soft, 100% 초과 시에는 "지출 경고" 용도인
// --paylens-accent로 전환한다(색상 용도는 두 값 모두 CLAUDE.md 색상 표 참고).
export function BudgetGauge({ spent, limit }: { spent: number; limit: number }) {
  if (limit <= 0) return null;

  const percent = Math.round((spent / limit) * 100);
  const isOver = spent > limit;
  const barWidth = Math.min(percent, 100);

  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${barWidth}%`,
            backgroundColor: isOver ? "var(--paylens-accent)" : "var(--paylens-data-soft)",
          }}
        />
      </div>
      <p
        className={`text-xs ${isOver ? "font-semibold text-[var(--paylens-accent)]" : "text-[var(--color-text-secondary)]"}`}
      >
        {spent.toLocaleString("ko-KR")}원 / {limit.toLocaleString("ko-KR")}원 · {percent}%
        {isOver ? " 초과" : ""}
      </p>
    </div>
  );
}
