"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { Database } from "@account-books/types";
import { ExpenseEntryForm } from "../ExpenseEntryForm";
import { buildFormValuesFromTransaction } from "@/lib/expense-form-values";
import { DeleteExpenseButton } from "../[id]/edit/DeleteExpenseButton";

type PaymentMethod = Database["public"]["Tables"]["payment_method"]["Row"];
type Category = Database["public"]["Tables"]["category"]["Row"];
type Vendor = Database["public"]["Tables"]["vendor"]["Row"];
type Item = Database["public"]["Tables"]["item"]["Row"];
type Unit = Database["public"]["Tables"]["unit"]["Row"];
type TransactionDetail = Database["public"]["Tables"]["transaction_detail"]["Row"];
type TransactionRow = Database["public"]["Tables"]["transaction"]["Row"];

export type EditableTransaction = TransactionRow & {
  vendor: { name: string } | null;
  transaction_detail: TransactionDetail[];
  // [F-2-4-1] 관리비 명세서 업로드로 등록된 트랜잭션인지 판별(안내 아이콘용) — transaction_id가
  // UNIQUE라 supabase-js가 1:1 관계로 추론해 배열이 아니라 단일 객체/null로 내려온다.
  utility_bill_record: { id: string } | null;
};

// F-1-10-2: 캘린더 날짜 셀에서 기존 지출을 클릭했을 때 뜨는 수정 레이어 팝업 — /expenses/[id]/edit
// 페이지로 이동하는 대신, 같은 ExpenseEntryForm(+ DeleteExpenseButton)을 그대로 재사용해 그 자리에서
// 열고 닫는다. buildFormValuesFromTransaction으로 전체화면 수정 페이지와 동일한 변환 로직을 공유.
export function EditExpenseDialog({
  transaction,
  onOpenChange,
  paymentMethods,
  categories,
  vendors,
  items,
  units,
}: {
  transaction: EditableTransaction | null;
  onOpenChange: (open: boolean) => void;
  paymentMethods: PaymentMethod[];
  categories: Category[];
  vendors: Vendor[];
  items: Item[];
  units: Unit[];
}) {
  const [showUtilityBillInfo, setShowUtilityBillInfo] = useState(false);
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));
  const formValues = transaction ? buildFormValuesFromTransaction(transaction, unitNameById) : null;
  const isUtilityBill = transaction?.utility_bill_record != null;

  return (
    <Dialog.Root open={transaction !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <Dialog.Close
            aria-label="닫기"
            className="absolute top-4 right-4 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <X size={18} />
          </Dialog.Close>
          {/* transaction.id로 key를 걸어 다른 지출로 전환될 때마다 안내 문구 펼침 상태를 초기화. */}
          <div key={transaction?.id ?? "empty"} className="mb-4">
            <div className="flex items-center gap-1.5">
              <Dialog.Title className="text-base font-bold text-[var(--color-text-primary)]">
                지출 수정
              </Dialog.Title>
              {isUtilityBill && (
                <button
                  type="button"
                  onClick={() => setShowUtilityBillInfo((v) => !v)}
                  aria-label="관리비 명세서 안내"
                  aria-expanded={showUtilityBillInfo}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--paylens-action)]/10 text-xs text-[var(--paylens-action)]"
                >
                  ℹ️
                </button>
              )}
            </div>
            {isUtilityBill && showUtilityBillInfo && (
              <div className="mt-2 rounded-lg border border-[var(--paylens-action)] bg-[var(--paylens-action)]/5 p-3 text-sm text-[var(--color-text-primary)]">
                이 지출은 관리비 명세서로 등록되었습니다. 금액을 수정해도 항목별 통계는 원본 그대로
                유지됩니다.
              </div>
            )}
          </div>
          {transaction && formValues && (
            <ExpenseEntryForm
              key={transaction.id}
              paymentMethods={paymentMethods}
              categories={categories}
              vendors={vendors}
              items={items}
              units={units}
              transactionId={transaction.id}
              initialValues={formValues.initialValues}
              initialDetailRows={formValues.initialDetailRows}
              isUtilityBill={isUtilityBill}
              onSuccess={() => onOpenChange(false)}
              secondaryActions={
                <DeleteExpenseButton
                  transactionId={transaction.id}
                  onDeleted={() => onOpenChange(false)}
                  className="flex-1"
                />
              }
            />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
