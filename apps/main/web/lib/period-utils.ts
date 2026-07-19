export function lastDayOfPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const last = new Date(year!, month!, 0); // month(1~12)를 그대로 넣으면 그 달의 마지막 날짜가 됨
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

// [F-2-4-4] "YYYY-MM" 청구월 문자열에 개월 수를 더하고(음수면 빼고) 다시 "YYYY-MM"으로 반환.
export function addMonthsToPeriod(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(year!, month! - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
