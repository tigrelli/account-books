"use client";

import { useRouter } from "next/navigation";
import type { Database } from "@account-books/types";
import { ExpenseEntryForm, type DetailRow, type FieldValues } from "../../ExpenseEntryForm";

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
}: {
  paymentMethods: PaymentMethod[];
  categories: Category[];
  vendors: Vendor[];
  items: Item[];
  units: Unit[];
  transactionId: string;
  initialValues: FieldValues;
  initialDetailRows: DetailRow[];
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
      onSuccess={() => router.push("/expenses")}
    />
  );
}
