"use client";

import { useActionState, useState } from "react";
import type { Database } from "@account-books/types";
import { CATEGORY_FIELD_PREFIX } from "@/lib/budget-schemas";
import { saveBudgetsAction, type BudgetActionState } from "./actions";
import { ConfirmDialog } from "./ConfirmDialog";
import { SuccessDialog } from "./SuccessDialog";
import { BudgetGauge } from "./BudgetGauge";

type Category = Database["public"]["Tables"]["category"]["Row"];
type Budget = Database["public"]["Tables"]["budget"]["Row"];
type BudgetTotal = Database["public"]["Tables"]["budget_total"]["Row"];

const initialState: BudgetActionState = { status: "idle" };

function AmountField({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const displayValue = value ? Number(value).toLocaleString("ko-KR") : "";

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={displayValue}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        className="h-10 min-w-0 flex-1 rounded-lg border border-[#e2e8f0] px-3.5 text-right font-mono text-sm outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15"
      />
      <input type="hidden" name={name} value={value} />
    </>
  );
}

function CategoryRow({
  category,
  amount,
  onChange,
  spent,
  savedLimit,
}: {
  category: Category;
  amount: string;
  onChange: (v: string) => void;
  spent: number;
  savedLimit: number;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-[#e2e8f0] p-3">
      <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-sm text-[var(--color-text-primary)]">
          {category.icon ? `${category.icon} ` : ""}
          {category.name}
        </span>
        <AmountField
          name={`${CATEGORY_FIELD_PREFIX}${category.id}`}
          value={amount}
          onChange={onChange}
        />
        <span className="shrink-0 text-sm text-[var(--color-text-secondary)]">원</span>
      </div>
      <BudgetGauge spent={spent} limit={savedLimit} />
    </div>
  );
}

// 화면 전체가 하나의 폼(2026-07-03 PM 결정) — 전체 예산 + 카테고리별 예산을 각자 등록/저장
// 버튼 없이 입력만 해두고, 맨 아래 "등록" 버튼 하나로 한 번에 저장한다. "리셋"은 서버에
// 즉시 반영하지 않고 화면의 카테고리별 입력값만 0으로 되돌린다 — 실제 삭제는 그 상태로
// "등록"을 눌러야 반영됨(actions.ts의 saveBudgetsAction: 금액 0은 "예산 없음"으로 해석해 삭제).
export function BudgetSection({
  categories,
  budgets,
  budgetTotal,
  actualByCategory,
  totalActual,
  period,
}: {
  categories: Category[];
  budgets: Budget[];
  budgetTotal: BudgetTotal | undefined;
  actualByCategory: Record<string, number>;
  totalActual: number;
  period: string;
}) {
  const budgetByCategoryId = new Map(budgets.map((b) => [b.category_id, b]));
  const [totalAmount, setTotalAmount] = useState(
    budgetTotal ? String(budgetTotal.limit_amount) : "0"
  );
  const [categoryAmounts, setCategoryAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      categories.map((c) => [c.id, String(budgetByCategoryId.get(c.id)?.limit_amount ?? "0")])
    )
  );
  const [state, formAction, isPending] = useActionState(
    saveBudgetsAction.bind(null, period),
    initialState
  );
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setSuccessDialogOpen(true);
  }

  const categoryTotal = Object.values(categoryAmounts).reduce(
    (sum, v) => sum + Number(v || "0"),
    0
  );
  const remaining = Number(totalAmount || "0") - categoryTotal;

  return (
    <form action={formAction} className="space-y-3">
      <div className="rounded-lg border border-[var(--paylens-action)] bg-[var(--paylens-action)]/5 p-3">
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-sm font-bold text-[var(--color-text-primary)]">
            전체 예산
          </span>
          <AmountField name="totalAmount" value={totalAmount} onChange={setTotalAmount} />
          <span className="shrink-0 text-sm text-[var(--color-text-secondary)]">원</span>
        </div>
        <div className="mt-1.5">
          <BudgetGauge spent={totalActual} limit={budgetTotal?.limit_amount ?? 0} />
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-secondary)]">
        카테고리별 예산 합계 {categoryTotal.toLocaleString("ko-KR")}원 · 남은 배분 가능 금액{" "}
        <span className="font-mono font-semibold text-[var(--color-text-primary)]">
          {remaining.toLocaleString("ko-KR")}원
        </span>
      </p>

      <div className="space-y-2">
        {categories.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">등록된 지출항목이 없습니다</p>
        ) : (
          categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              amount={categoryAmounts[category.id] ?? "0"}
              onChange={(v) => setCategoryAmounts((prev) => ({ ...prev, [category.id]: v }))}
              spent={actualByCategory[category.id] ?? 0}
              savedLimit={budgetByCategoryId.get(category.id)?.limit_amount ?? 0}
            />
          ))
        )}
      </div>

      {state.status === "error" && (
        <p className="text-sm font-medium text-[var(--paylens-accent)]">{state.message}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setResetDialogOpen(true)}
          className="h-10 rounded-lg border border-[#e2e8f0] px-4 text-sm font-semibold text-[var(--color-text-secondary)]"
        >
          리셋
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-lg bg-[var(--paylens-action)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "등록 중…" : "등록"}
        </button>
      </div>

      <ConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        message="전체 항목 예산을 초기화하시겠습니까?"
        confirmLabel="초기화"
        onConfirm={() => setCategoryAmounts(Object.fromEntries(categories.map((c) => [c.id, "0"])))}
      />
      <SuccessDialog
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        message="등록이 완료되었습니다."
      />
    </form>
  );
}
