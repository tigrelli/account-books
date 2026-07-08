"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Database } from "@account-books/types";
import { ExpenseEntryForm } from "../ExpenseEntryForm";
import { ActionToast } from "../../_components/ActionToast";

type PaymentMethod = Database["public"]["Tables"]["payment_method"]["Row"];
type Category = Database["public"]["Tables"]["category"]["Row"];
type Vendor = Database["public"]["Tables"]["vendor"]["Row"];
type Item = Database["public"]["Tables"]["item"]["Row"];
type Unit = Database["public"]["Tables"]["unit"]["Row"];

// 지출 입력(신규) 화면은 저장 후에도 이어서 입력하는 흐름이 기본이라(ExpenseEntryForm이 저장
// 성공 시 폼을 스스로 리셋) 수정 화면처럼 곧장 목록으로 이동하지 않는다 — 대신 하단 토스트로
// "지출내역 확인으로 이동" 여부만 물어보고, 응답이 없으면 계속 이 화면에 머문다(PM 요청, 2026-07-05).
export function CreateExpenseFormClient({
  paymentMethods,
  categories,
  vendors,
  items,
  units,
}: {
  paymentMethods: PaymentMethod[];
  categories: Category[];
  vendors: Vendor[];
  items: Item[];
  units: Unit[];
}) {
  const router = useRouter();
  const [toastOpen, setToastOpen] = useState(false);

  return (
    <>
      <ExpenseEntryForm
        paymentMethods={paymentMethods}
        categories={categories}
        vendors={vendors}
        items={items}
        units={units}
        onSuccess={() => setToastOpen(true)}
      />
      <ActionToast
        open={toastOpen}
        message="지출내역 확인으로 이동하시겠습니까?"
        actionLabel="이동"
        onAction={() => router.push("/expenses")}
        onDismiss={() => setToastOpen(false)}
      />
    </>
  );
}
