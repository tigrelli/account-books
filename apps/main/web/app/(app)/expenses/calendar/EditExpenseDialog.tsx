"use client";

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
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));
  const formValues = transaction ? buildFormValuesFromTransaction(transaction, unitNameById) : null;

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
          <Dialog.Title className="mb-4 text-base font-bold text-[var(--color-text-primary)]">
            지출 수정
          </Dialog.Title>
          {transaction && formValues && (
            <>
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
                onSuccess={() => onOpenChange(false)}
              />
              <div className="mt-4 flex justify-center border-t border-[#e2e8f0] pt-4">
                <DeleteExpenseButton
                  transactionId={transaction.id}
                  onDeleted={() => onOpenChange(false)}
                />
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
