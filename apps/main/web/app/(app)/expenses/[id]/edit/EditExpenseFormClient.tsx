"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Database } from "@account-books/types";
import { ExpenseEntryForm, type DetailRow, type FieldValues } from "../../ExpenseEntryForm";
import { DeleteExpenseButton } from "./DeleteExpenseButton";

type PaymentMethod = Database["public"]["Tables"]["payment_method"]["Row"];
type Category = Database["public"]["Tables"]["category"]["Row"];
type Vendor = Database["public"]["Tables"]["vendor"]["Row"];
type Item = Database["public"]["Tables"]["item"]["Row"];
type Unit = Database["public"]["Tables"]["unit"]["Row"];

// updateExpenseAction이 더 이상 서버에서 강제 redirect하지 않으므로(F-1-10-2, 캘린더 팝업 재사용을
// 위해 변경) 이 화면(전체 페이지 수정)만 저장 성공 시 목록으로 이동하도록 여기서 직접 라우팅한다.
export function EditExpenseFormClient({
  paymentMethods,
  categories,
  vendors,
  items,
  units,
  transactionId,
  initialValues,
  initialDetailRows,
  listHref,
  isUtilityBill,
}: {
  paymentMethods: PaymentMethod[];
  categories: Category[];
  vendors: Vendor[];
  items: Item[];
  units: Unit[];
  transactionId: string;
  initialValues: FieldValues;
  initialDetailRows: DetailRow[];
  listHref: string;
  isUtilityBill: boolean;
}) {
  const router = useRouter();

  return (
    <ExpenseEntryForm
      paymentMethods={paymentMethods}
      categories={categories}
      vendors={vendors}
      items={items}
      units={units}
      transactionId={transactionId}
      initialValues={initialValues}
      initialDetailRows={initialDetailRows}
      isUtilityBill={isUtilityBill}
      onSuccess={() => router.push(listHref)}
      secondaryActions={
        <>
          <Link
            href={listHref}
            prefetch={false}
            className="flex h-10 flex-1 items-center justify-center rounded-lg border border-[#e2e8f0] text-sm font-semibold text-[var(--color-text-primary)]"
          >
            목록
          </Link>
          <DeleteExpenseButton
            transactionId={transactionId}
            redirectHref={listHref}
            className="flex-1"
          />
        </>
      }
    />
  );
}
