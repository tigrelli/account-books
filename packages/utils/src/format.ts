const KRW_FORMATTER = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

/** ₩1,234,567 형식으로 반환 */
export function formatCurrency(amount: number): string {
  return KRW_FORMATTER.format(amount);
}

/** 부호 포함 금액 (+₩1,234 / -₩1,234) */
export function formatCurrencySigned(amount: number): string {
  const prefix = amount > 0 ? "+" : "";
  return `${prefix}${formatCurrency(amount)}`;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** 2025. 06. 26. 형식 */
export function formatDate(date: Date | string): string {
  return DATE_FORMATTER.format(new Date(date));
}

/** 2025. 06. 26. 오후 03:00 형식 */
export function formatDateTime(date: Date | string): string {
  return DATETIME_FORMATTER.format(new Date(date));
}

/** YYYY-MM 형식 (월별 집계 키로 사용) */
export function toYearMonth(date: Date | string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
