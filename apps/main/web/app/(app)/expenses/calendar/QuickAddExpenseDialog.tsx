"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { Database } from "@account-books/types";
import { ExpenseEntryForm } from "../ExpenseEntryForm";
import { emptyValues } from "@/lib/expense-form-values";

type PaymentMethod = Database["public"]["Tables"]["payment_method"]["Row"];
type Category = Database["public"]["Tables"]["category"]["Row"];
type Vendor = Database["public"]["Tables"]["vendor"]["Row"];
type Item = Database["public"]["Tables"]["item"]["Row"];
type Unit = Database["public"]["Tables"]["unit"]["Row"];

// F-1-10-2: 캘린더 날짜 셀의 "+"에서 뜨는 빠른 입력 레이어 팝업 — 이미 재사용 가능하게 설계된
// ExpenseEntryForm에 클릭한 날짜만 초기값으로 주입해 그대로 얹는다(새 폼을 만들지 않음).
// 저장 성공 시 폼의 onSuccess 훅으로 팝업을 닫고, 서버 액션의 revalidatePath(CALENDAR_PATH)가
// 같은 라우트의 캘린더 데이터를 자동 갱신한다.
export function QuickAddExpenseDialog({
  date,
  onOpenChange,
  paymentMethods,
  categories,
  vendors,
  items,
  units,
}: {
  date: string | null;
  onOpenChange: (open: boolean) => void;
  paymentMethods: PaymentMethod[];
  categories: Category[];
  vendors: Vendor[];
  items: Item[];
  units: Unit[];
}) {
  return (
    <Dialog.Root open={date !== null} onOpenChange={onOpenChange}>
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
            {date} 지출 입력
          </Dialog.Title>
          {date && (
            <ExpenseEntryForm
              key={date}
              paymentMethods={paymentMethods}
              categories={categories}
              vendors={vendors}
              items={items}
              units={units}
              initialValues={{ ...emptyValues, occurredAt: date }}
              onSuccess={() => onOpenChange(false)}
            />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
