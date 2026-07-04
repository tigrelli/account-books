// ExpenseEntryForm.tsx("use client")와 달리 이 파일은 서버 컴포넌트에서도 직접 호출 가능해야 해서
// 별도 모듈로 분리 — "use client" 파일의 export는 서버에서 함수로 직접 호출할 수 없음(RSC 경계 제약).
// /expenses/[id]/edit(서버 컴포넌트)와 캘린더 수정 팝업(클라이언트 컴포넌트)이 공통으로 사용.

export type FieldValues = {
  occurredAt: string;
  paymentMethodId: string;
  categoryId: string;
  vendorName: string;
  amount: string;
};

// toISOString()은 UTC 기준으로 변환하므로 KST 자정~오전 9시 사이엔 하루 전 날짜가 나옴 —
// 로컬 타임존 기준 연/월/일을 직접 조합해야 사용자가 보는 "오늘"과 일치한다.
export function todayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// F-1-10-2: 캘린더 빠른 입력 팝업에서 특정 날짜만 미리 채운 초기값을 만들 때 재사용.
export const emptyValues: FieldValues = {
  occurredAt: todayDateInputValue(),
  paymentMethodId: "",
  categoryId: "",
  vendorName: "",
  amount: "",
};

// 상세항목은 아직 서버로 제출되지 않는 UI 전용 상태 — 저장 연동은 F-1-5-6~11에서 처리.
// itemId: 자동완성으로 기존 Item을 선택한 경우만 채워짐. 빈 문자열이면 자유 입력(신규 후보) 상태.
export type DetailRow = {
  id: string;
  itemText: string;
  itemId: string;
  quantityText: string;
  amount: string;
};

// F-1-10-2: /expenses/[id]/edit 페이지와 캘린더 수정 팝업이 공통으로 쓰는 변환 로직 —
// Supabase에서 조회한 transaction(+transaction_detail)을 폼 초기값으로 바꾼다.
export function buildFormValuesFromTransaction(
  transaction: {
    occurred_at: string;
    payment_method_id: string;
    category_id: string;
    amount: number;
    has_detail: boolean;
    vendor: { name: string } | null;
    transaction_detail: {
      id: string;
      item_raw_text: string;
      item_id: string;
      quantity_raw_text: string | null;
      quantity_value: number | null;
      unit_id: string | null;
      amount: number;
    }[];
  },
  unitNameById: Map<string, string>
): { initialValues: FieldValues; initialDetailRows: DetailRow[] } {
  const initialValues: FieldValues = {
    occurredAt: transaction.occurred_at.slice(0, 10),
    paymentMethodId: transaction.payment_method_id,
    categoryId: transaction.category_id,
    vendorName: transaction.vendor?.name ?? "",
    amount: transaction.has_detail ? "" : String(transaction.amount),
  };

  const initialDetailRows: DetailRow[] = transaction.has_detail
    ? transaction.transaction_detail.map((d) => ({
        id: d.id,
        itemText: d.item_raw_text,
        itemId: d.item_id,
        quantityText:
          d.quantity_raw_text ??
          (d.quantity_value != null
            ? `${d.quantity_value}${unitNameById.get(d.unit_id ?? "") ?? ""}`
            : ""),
        amount: String(d.amount),
      }))
    : [];

  return { initialValues, initialDetailRows };
}
