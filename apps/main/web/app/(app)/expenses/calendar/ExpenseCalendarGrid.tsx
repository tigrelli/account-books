"use client";

import { useState } from "react";
import type { Database } from "@account-books/types";
import { QuickAddExpenseDialog } from "./QuickAddExpenseDialog";
import { EditExpenseDialog, type EditableTransaction } from "./EditExpenseDialog";

type PaymentMethod = Database["public"]["Tables"]["payment_method"]["Row"];
type Category = Database["public"]["Tables"]["category"]["Row"];
type Vendor = Database["public"]["Tables"]["vendor"]["Row"];
type Item = Database["public"]["Tables"]["item"]["Row"];
type Unit = Database["public"]["Tables"]["unit"]["Row"];

type CalendarTransaction = EditableTransaction & {
  category: Pick<Category, "name" | "icon"> | null;
  payment_method: Pick<PaymentMethod, "display_name" | "type" | "card_kind"> | null;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// 결제수단 유형별 색상 — PaymentMethodTag/PaymentMethodBreakdownChart와 동일한 예약 토큰 재사용
// (달력 카드는 공간이 좁아 아이콘+텍스트 태그 대신 점 하나로 축약 — 색상 의미는 앱 전역과 동일하게 유지).
function paymentMethodDotColor(pm: Pick<PaymentMethod, "type" | "card_kind"> | null): string {
  if (!pm) return "#94a3b8";
  if (pm.type === "CASH") return "var(--paylens-cash)";
  return pm.card_kind === "CREDIT" ? "var(--paylens-credit)" : "var(--paylens-check)";
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// F-1-10-1: 월별 캘린더 그리드 — 일요일 시작 6주(최대 42칸) 고정, 이전/다음달 날짜는 흐리게 표시.
function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const gridStart = new Date(year, month - 1, 1 - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

export function ExpenseCalendarGrid({
  year,
  month,
  transactions,
  paymentMethods,
  categories,
  vendors,
  items,
  units,
}: {
  year: number;
  month: number;
  transactions: CalendarTransaction[];
  paymentMethods: PaymentMethod[];
  categories: Category[];
  vendors: Vendor[];
  items: Item[];
  units: Unit[];
}) {
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [editTransaction, setEditTransaction] = useState<CalendarTransaction | null>(null);
  const todayKey = dateKey(new Date());

  const transactionsByDate = new Map<string, CalendarTransaction[]>();
  for (const tx of transactions) {
    const key = dateKey(new Date(tx.occurred_at));
    const list = transactionsByDate.get(key) ?? [];
    list.push(tx);
    transactionsByDate.set(key, list);
  }

  const cells = buildMonthGrid(year, month);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-[#e2e8f0]">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cellDate) => {
          const key = dateKey(cellDate);
          const isCurrentMonth = cellDate.getMonth() === month - 1;
          const isToday = key === todayKey;
          const dayTransactions = transactionsByDate.get(key) ?? [];

          return (
            <div
              key={key}
              className={`group relative min-h-16 border-r border-b border-[#e2e8f0] p-1.5 last:border-r-0 sm:min-h-32 sm:p-2 ${
                isCurrentMonth ? "bg-white" : "bg-[var(--paylens-bg)]/60"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-[var(--paylens-accent)] font-bold text-white"
                      : isCurrentMonth
                        ? "text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)]/50"
                  }`}
                >
                  {cellDate.getDate()}
                </span>
                <button
                  type="button"
                  onClick={() => setQuickAddDate(key)}
                  aria-label={`${key} 지출 빠른 입력`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-sm leading-none text-[var(--color-text-secondary)] opacity-60 transition-opacity hover:bg-[var(--paylens-bg)] focus-visible:opacity-100 sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  +
                </button>
              </div>

              {/* 모바일(<640px)은 카드 텍스트(지출처명/금액)가 잘려서 의미가 없어지므로 결제수단 색 점만
                  나열 — 탭하면 해당 지출 상세로 이동. 태블릿(sm) 이상만 지출처명+금액 카드 표시. */}
              <div className="flex flex-wrap gap-1 sm:hidden">
                {dayTransactions.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => setEditTransaction(tx)}
                    title={`${tx.vendor?.name ?? "-"} · ${tx.amount.toLocaleString("ko-KR")}원`}
                    className="block p-0.5"
                  >
                    <span
                      className="block h-2 w-2 rounded-full"
                      style={{ backgroundColor: paymentMethodDotColor(tx.payment_method) }}
                    />
                  </button>
                ))}
              </div>

              <div className="hidden space-y-1 sm:block">
                {dayTransactions.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => setEditTransaction(tx)}
                    title={`${tx.vendor?.name ?? "-"} · ${tx.amount.toLocaleString("ko-KR")}원`}
                    className="block w-full rounded-md border border-[#e2e8f0] px-1.5 py-1 text-left text-[11px] hover:border-[var(--paylens-action)]"
                  >
                    <p className="truncate font-medium text-[var(--color-text-primary)]">
                      {tx.category?.icon ? `${tx.category.icon} ` : ""}
                      {tx.vendor?.name ?? "-"}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: paymentMethodDotColor(tx.payment_method) }}
                      />
                      <span className="truncate font-mono text-[var(--color-text-secondary)]">
                        {tx.amount.toLocaleString("ko-KR")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <QuickAddExpenseDialog
        date={quickAddDate}
        onOpenChange={(open) => setQuickAddDate(open ? quickAddDate : null)}
        paymentMethods={paymentMethods}
        categories={categories}
        vendors={vendors}
        items={items}
        units={units}
      />

      <EditExpenseDialog
        transaction={editTransaction}
        onOpenChange={(open) => setEditTransaction(open ? editTransaction : null)}
        paymentMethods={paymentMethods}
        categories={categories}
        vendors={vendors}
        items={items}
        units={units}
      />
    </div>
  );
}
