export function lastDayOfPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const last = new Date(year!, month!, 0); // month(1~12)를 그대로 넣으면 그 달의 마지막 날짜가 됨
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}
