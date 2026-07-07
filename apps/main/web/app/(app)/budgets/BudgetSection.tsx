"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@account-books/types";
import { CATEGORY_FIELD_PREFIX } from "@/lib/budget-schemas";
import { saveBudgetsAction, resetBudgetsAction, type BudgetActionState } from "./actions";
import { ConfirmDialog } from "../_components/ConfirmDialog";
import { SuccessDialog } from "../_components/SuccessDialog";
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
// 버튼 없이 입력만 해두고, 맨 아래 "등록" 버튼 하나로 한 번에 저장한다. "리셋"은 이미
// ConfirmDialog로 재확인을 거치므로, 확인 즉시 resetBudgetsAction으로 서버에도 바로 반영한다
// (예전에는 화면 입력값만 0으로 되돌리고 "등록"을 다시 눌러야 실제 삭제돼, 리셋 직후
// 새로고침하면 예전 값이 그대로 돌아오는 문제가 있었다 — PM 리포트, 2026-07-07).
export function BudgetSection({
  categories,
  budgets,
  budgetTotal,
  actualByCategory,
  totalActual,
  period,
  previousTotalAmount,
  previousCategoryAmounts,
}: {
  categories: Category[];
  budgets: Budget[];
  budgetTotal: BudgetTotal | undefined;
  actualByCategory: Record<string, number>;
  totalActual: number;
  period: string;
  previousTotalAmount: number | undefined;
  previousCategoryAmounts: Record<string, number>;
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
  const router = useRouter();
  const [isResetPending, startResetTransition] = useTransition();
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("등록이 완료되었습니다.");

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") {
      setSuccessMessage("등록이 완료되었습니다.");
      setSuccessDialogOpen(true);
    }
  }

  function handleReset() {
    startResetTransition(async () => {
      const result = await resetBudgetsAction(period);
      if (result.status === "error") {
        setResetError(result.message);
        return;
      }
      setResetError(null);
      setTotalAmount("0");
      setCategoryAmounts(Object.fromEntries(categories.map((c) => [c.id, "0"])));
      setSuccessMessage("초기화되었습니다.");
      setSuccessDialogOpen(true);
      // budgets/budgetTotal은 서버 컴포넌트(page.tsx)가 내려준 props라 로컬 입력값만 0으로
      // 되돌리는 것만으로는 게이지(BudgetGauge)의 savedLimit이 갱신되지 않는다 — router.refresh()로
      // 서버 데이터를 다시 가져와야 새로고침 없이도 게이지까지 실제로 초기화된 상태로 보인다.
      router.refresh();
    });
  }

  const hasPreviousBudget = previousTotalAmount !== undefined;

  // 지난달 예산 불러오기(F-1-7-3 리뷰) — 리셋과 달리 서버에 바로 반영하지 않고 화면 입력값만
  // 채운다. 지난달을 "시작점(템플릿)"으로 두고 몇몇 카테고리만 조정한 뒤 "등록"을 누르는
  // 흐름을 위해서라, 값을 검토/수정할 여지를 남겨야 한다(PM 결정, 2026-07-07).
  function applyCopyFromPreviousPeriod() {
    setTotalAmount(String(previousTotalAmount ?? 0));
    setCategoryAmounts(
      Object.fromEntries(categories.map((c) => [c.id, String(previousCategoryAmounts[c.id] ?? 0)]))
    );
  }

  function handleCopyClick() {
    const hasCurrentInput =
      Number(totalAmount || "0") !== 0 ||
      Object.values(categoryAmounts).some((v) => Number(v || "0") !== 0);
    if (hasCurrentInput) {
      setCopyConfirmOpen(true);
    } else {
      applyCopyFromPreviousPeriod();
    }
  }

  const categoryTotal = Object.values(categoryAmounts).reduce(
    (sum, v) => sum + Number(v || "0"),
    0
  );
  const remaining = Number(totalAmount || "0") - categoryTotal;

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleCopyClick}
          disabled={!hasPreviousBudget || isPending || isResetPending}
          title={hasPreviousBudget ? undefined : "지난달에 등록된 예산이 없습니다"}
          className="text-xs font-medium text-[var(--paylens-action)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--color-text-secondary)] disabled:no-underline"
        >
          지난달 예산 불러오기
        </button>
      </div>

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

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
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

      {(state.status === "error" || resetError) && (
        <p className="text-sm font-medium text-[var(--paylens-accent)]">
          {resetError ?? (state.status === "error" ? state.message : "")}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setResetDialogOpen(true)}
          disabled={isResetPending}
          className="h-10 rounded-lg border border-[#e2e8f0] px-4 text-sm font-semibold text-[var(--color-text-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResetPending ? "초기화 중…" : "리셋"}
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
        message="전체 항목 예산을 초기화하시겠습니까? 되돌릴 수 없습니다."
        confirmLabel="초기화"
        onConfirm={handleReset}
      />
      <ConfirmDialog
        open={copyConfirmOpen}
        onOpenChange={setCopyConfirmOpen}
        message="지난달 예산을 불러오면 현재 입력된 값이 덮어써집니다. 계속하시겠습니까?"
        confirmLabel="불러오기"
        onConfirm={applyCopyFromPreviousPeriod}
      />
      <SuccessDialog
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        message={successMessage}
      />
    </form>
  );
}
