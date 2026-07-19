"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Database } from "@account-books/types";
import { addExpenseAction, updateExpenseAction, type ExpenseActionState } from "./actions";
import { parseQuantityText } from "@/lib/quantity-parse";
import { sumDetailAmounts } from "@/lib/expense-calculations";
import { formatPaymentMethodLabel } from "@/lib/payment-method-format";
import { itemAliasesToArray } from "@/lib/item-aliases";
import { emptyValues, type DetailRow, type FieldValues } from "@/lib/expense-form-values";
import { SuccessDialog } from "../_components/SuccessDialog";
import { useQueryClient } from "@tanstack/react-query";

export type { DetailRow, FieldValues } from "@/lib/expense-form-values";

type PaymentMethod = Database["public"]["Tables"]["payment_method"]["Row"];
type Category = Database["public"]["Tables"]["category"]["Row"];
type Vendor = Database["public"]["Tables"]["vendor"]["Row"];
type Item = Database["public"]["Tables"]["item"]["Row"];
type Unit = Database["public"]["Tables"]["unit"]["Row"];

// 마지막 글자의 받침 유무 판별 (유니코드 완성형 한글 음절 기준). 한글이 아니면 받침 없음으로 취급.
function hasBatchim(word: string): boolean {
  const lastChar = word.trim().slice(-1);
  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function waOrGwa(word: string): "와" | "과" {
  return hasBatchim(word) ? "과" : "와";
}

function itemSearchTerms(item: Item): string[] {
  return [item.name, ...itemAliasesToArray(item.aliases)];
}

function itemMatchesQuery(item: Item, query: string): boolean {
  return itemSearchTerms(item).some((term) => term.toLowerCase().includes(query));
}

// 편집거리(Levenshtein) — 표준 DP 구현. 리스트가 작아(사용자별 ITEM) 매 입력마다 계산해도 무리 없음.
function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i]![0] = i;
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[a.length]![b.length]!;
}

// 정확히/부분일치하는 후보가 없을 때만 호출 — 편집거리가 짧은 "비슷한 이름"의 기존 Item을 하나 제안.
// 동의어 사전(SYNONYM_DICTIONARY) 연동은 해당 테이블이 Phase 3에 생성될 예정이라 이번 범위 밖(WBS F-1-5-7 중 편집거리 부분만 우선 구현).
function findSimilarItem(query: string, items: Item[]): Item | null {
  const q = query.toLowerCase();
  let best: { item: Item; distance: number } | null = null;

  for (const item of items) {
    for (const term of itemSearchTerms(item)) {
      const distance = levenshteinDistance(q, term.toLowerCase());
      const threshold = Math.max(1, Math.round(Math.max(q.length, term.length) * 0.34));
      if (distance > 0 && distance <= threshold && (!best || distance < best.distance)) {
        best = { item, distance };
      }
    }
  }

  return best?.item ?? null;
}

const inputClassName =
  "h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15";

// 비고(메모) 입력 상한 — expense-schemas.ts의 memo 스키마와 반드시 동일한 값 유지.
const MEMO_MAX_LENGTH = 1000;

const initialState: ExpenseActionState = { status: "idle" };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">
      {children}
    </label>
  );
}

function FieldError({ messages }: { messages?: string[] | undefined }) {
  if (!messages?.[0]) return null;
  return <p className="mt-1 text-xs text-[var(--paylens-accent)]">{messages[0]}</p>;
}

// 화면엔 천단위 콤마(예: 15,000)로 보여주되, 실제 제출값(hidden input)은 숫자만 담긴 문자열로 유지 —
// <input type="number">는 콤마 같은 비숫자 문자를 표시할 수 없어 type="text"로 바꾸고 직접 포맷/파싱.
function AmountInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  className,
}: {
  // 상세항목 행처럼 같은 name(detailAmount)이 여러 개 반복되는 경우 id 중복을 피하려면
  // 지정하지 않는다 — 단일 필드(직접입력 금액)에서만 포커스 이동 타겟으로 넘겨준다.
  id?: string;
  name: string;
  value: string;
  onChange: (digitsOnly: string) => void;
  placeholder: string;
  className: string;
}) {
  const displayValue = value ? Number(value).toLocaleString("ko-KR") : "";

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={displayValue}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        className={className}
      />
      <input type="hidden" name={name} value={value} />
    </>
  );
}

function PaymentMethodSelect({
  paymentMethods,
  value,
  onChange,
  syncToken,
}: {
  paymentMethods: PaymentMethod[];
  value: string;
  onChange: (v: string) => void;
  syncToken: unknown;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);

  // React 19가 폼 액션 완료 후 <select>를 네이티브 reset()하면서 controlled value와 어긋나는 문제
  // (값은 그대로인데 화면엔 다른 옵션이 선택돼 보이는 desync)를 매 액션 결과마다 명시적으로 재동기화해 방지.
  useEffect(() => {
    if (selectRef.current) selectRef.current.value = value;
  }, [value, syncToken]);

  return (
    <select
      ref={selectRef}
      name="paymentMethodId"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClassName}
    >
      <option value="" disabled>
        지출분류 선택
      </option>
      {/* 2026-07-03 PM 결정: "표시명/구분" 표기로 이미 현금/카드 구분이 드러나므로 현금·카드 대분류(optgroup) 없이
          등록순(created_at asc, 조회 쿼리 기준)으로 같은 레벨에 나열. */}
      {paymentMethods.map((p) => (
        <option key={p.id} value={p.id}>
          {formatPaymentMethodLabel(p)}
        </option>
      ))}
    </select>
  );
}

function CategorySelect({
  categories,
  value,
  onChange,
  syncToken,
}: {
  categories: Category[];
  value: string;
  onChange: (v: string) => void;
  syncToken: unknown;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);

  // PaymentMethodSelect와 동일한 이유(React 19 액션 후 네이티브 reset desync 방지)로 재동기화.
  useEffect(() => {
    if (selectRef.current) selectRef.current.value = value;
  }, [value, syncToken]);

  return (
    <select
      ref={selectRef}
      name="categoryId"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClassName}
    >
      <option value="" disabled>
        지출항목 선택
      </option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.icon ? `${c.icon} ` : ""}
          {c.name}
        </option>
      ))}
    </select>
  );
}

// 지출처는 사전 등록이 필수가 아님 — 기존 항목 자동완성 선택 또는 자유 입력한 새 이름 그대로 제출.
// 실제 신규 등록 여부는 서버 액션(find-or-create)에서 결정되므로 여기서는 확인 절차 없음.
function VendorCombobox({
  vendors,
  value,
  onChange,
}: {
  vendors: Vendor[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const matches =
    value.trim().length === 0
      ? []
      : vendors
          .filter((v) => v.name.toLowerCase().includes(value.trim().toLowerCase()))
          .slice(0, 8);

  return (
    <div className="relative">
      <input
        name="vendorName"
        type="text"
        autoComplete="off"
        placeholder="지출처 입력 (예: 이마트)"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className={inputClassName}
      />
      {isOpen && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
          {matches.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(v.name);
                  setIsOpen(false);
                }}
                className="block w-full px-3.5 py-2 text-left text-sm hover:bg-[var(--paylens-bg)]"
              >
                {v.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 내 ITEM 마스터(name + aliases)에서 자동완성 — 정확히 일치하거나 유사한 후보를 보여주고 선택하게만 함.
// 자동완성에 없는 텍스트는 그냥 자유 입력 상태로 남겨둠(신규 Item 확정 생성은 F-1-5-6에서 처리).
function ItemCombobox({
  items,
  value,
  onChange,
}: {
  items: Item[];
  value: string;
  onChange: (patch: Partial<DetailRow>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const query = value.trim().toLowerCase();
  const matches =
    query.length === 0 ? [] : items.filter((item) => itemMatchesQuery(item, query)).slice(0, 8);

  return (
    <div className="relative">
      <input
        name="detailItemText"
        type="text"
        autoComplete="off"
        placeholder="품목명 (예: 양파)"
        value={value}
        onChange={(e) => {
          onChange({ itemText: e.target.value, itemId: "" });
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className={inputClassName}
      />
      {isOpen && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
          {matches.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange({ itemText: item.name, itemId: item.id });
                  setIsOpen(false);
                }}
                className="block w-full px-3.5 py-2 text-left text-sm hover:bg-[var(--paylens-bg)]"
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 수량/단위 자동완성(F-1-5-9) — 입력한 단위 텍스트와 일치하는 기존 UNIT을 보여주고 선택하게만 함.
// 목록에 없는 단위는 안내 문구 없이 저장 시 자동 등록(서버 액션의 resolveUnitId가 이미 find-or-create로
// 처리 — "신규 단위로 등록됩니다" 같은 안내는 불필요한 알림이라 제거, 2026-07-03 PM 결정).
function QuantityUnitInput({
  units,
  value,
  onChange,
}: {
  units: Unit[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const parsedQuantity = parseQuantityText(value);
  const unitQuery = parsedQuantity?.unitText.trim().toLowerCase() ?? "";
  const matches =
    unitQuery.length === 0
      ? []
      : units.filter((u) => u.name.toLowerCase().includes(unitQuery)).slice(0, 6);

  return (
    <div className="relative w-24 shrink-0">
      <input
        name="detailQuantityText"
        type="text"
        autoComplete="off"
        placeholder="수량/단위"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className={inputClassName}
      />
      {isOpen && matches.length > 0 && parsedQuantity && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
          {matches.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(`${parsedQuantity.value}${u.name}`);
                  setIsOpen(false);
                }}
                className="block w-full px-3.5 py-2 text-left text-sm hover:bg-[var(--paylens-bg)]"
              >
                {parsedQuantity.value}
                {u.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 동적 행 추가/삭제(F-1-5-4) + 품목 자동완성(F-1-5-5) + 신규 Item 안내(F-1-5-6) + 유사항목 제안(F-1-5-7)
// + 수량/단위 파싱 미리보기(F-1-5-8) + 단위 자동완성(F-1-5-9). 실제 저장은 actions.ts(F-1-5-11).
function DetailItemRows({
  rows,
  items,
  units,
  onChange,
}: {
  rows: DetailRow[];
  items: Item[];
  units: Unit[];
  onChange: (rows: DetailRow[]) => void;
}) {
  function updateRow(id: string, patch: Partial<DetailRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const query = row.itemText.trim().toLowerCase();
        const hasMatch = query.length > 0 && items.some((item) => itemMatchesQuery(item, query));
        // 정확히/부분일치하는 후보가 없을 때만 편집거리 기반으로 "혹시 이거?" 제안(F-1-5-7 — 동의어 사전 연동은 Phase 3 이후).
        const similarItem =
          !row.itemId && query.length > 0 && !hasMatch ? findSimilarItem(query, items) : null;
        const parsedQuantity = parseQuantityText(row.quantityText);

        return (
          <div
            key={row.id}
            className="flex items-start gap-2 rounded-lg border border-[#e2e8f0] p-3"
          >
            <div className="flex-1 space-y-1.5">
              <input type="hidden" name="detailItemId" value={row.itemId} />
              <ItemCombobox
                items={items}
                value={row.itemText}
                onChange={(patch) => updateRow(row.id, patch)}
              />
              {similarItem && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  혹시 &apos;{similarItem.name}&apos;{waOrGwa(similarItem.name)} 같은 품목인가요?{" "}
                  <button
                    type="button"
                    onClick={() =>
                      updateRow(row.id, { itemText: similarItem.name, itemId: similarItem.id })
                    }
                    className="font-medium text-[var(--paylens-action)] hover:underline"
                  >
                    예, 같은 품목이에요
                  </button>
                </p>
              )}
              {!similarItem && row.itemText.trim().length > 0 && !row.itemId && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  &apos;{row.itemText.trim()}&apos; 새 품목으로 등록됩니다
                </p>
              )}
              <div className="flex gap-1.5">
                <QuantityUnitInput
                  units={units}
                  value={row.quantityText}
                  onChange={(v) => updateRow(row.id, { quantityText: v })}
                />
                <AmountInput
                  name="detailAmount"
                  value={row.amount}
                  onChange={(v) => updateRow(row.id, { amount: v })}
                  placeholder="금액"
                  className={`${inputClassName} min-w-0 flex-1 font-mono`}
                />
              </div>
              {parsedQuantity && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {parsedQuantity.unitText
                    ? `→ 수량 ${parsedQuantity.value}, 단위 '${parsedQuantity.unitText}'`
                    : `→ 수량 ${parsedQuantity.value}`}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              aria-label={`${i + 1}번째 상세항목 삭제`}
              className="mt-1 shrink-0 text-xs font-medium text-[var(--color-text-secondary)] hover:underline"
            >
              삭제
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ExpenseEntryForm({
  paymentMethods,
  categories,
  vendors,
  items,
  units,
  transactionId,
  initialValues,
  initialDetailRows,
  onSuccess,
  secondaryActions,
  isUtilityBill = false,
}: {
  paymentMethods: PaymentMethod[];
  categories: Category[];
  vendors: Vendor[];
  items: Item[];
  units: Unit[];
  // 아래 3개가 함께 주어지면 수정 모드(/expenses/[id]/edit) — 없으면 신규 입력 모드(/expenses/create).
  transactionId?: string;
  initialValues?: FieldValues;
  initialDetailRows?: DetailRow[];
  // F-1-10-2: 캘린더 빠른 입력 팝업이 저장 성공 시 스스로 닫히도록 하는 훅 — 일반 페이지에서는 미사용.
  onSuccess?: () => void;
  // 수정 모드에서 "목록"/"삭제" 버튼을 제출 버튼과 같은 한 줄에 배치하기 위한 슬롯(PM 요청,
  // 2026-07-05) — 신규 입력 모드(저장하기)에서는 전달하지 않아 기존처럼 버튼 하나만 표시.
  secondaryActions?: React.ReactNode;
  // [F-2-4-1 개선, 2026-07-19 PM 요청] 관리비 명세서로 등록된 트랜잭션을 수정 저장할 때, 안내
  // 아이콘을 미리 열어보지 않은 사용자도 놓치지 않도록 "수정" 버튼 클릭 → 저장 성공 시 알림 팝업을
  // 띄운다. 수정 모드에서만 의미가 있어(신규 등록엔 "원본"이 없음) isEditMode와 함께 체크.
  isUtilityBill?: boolean;
}) {
  const isEditMode = transactionId !== undefined;
  const [state, formAction, isPending] = useActionState(
    isEditMode ? updateExpenseAction : addExpenseAction,
    initialState
  );
  const [values, setValues] = useState<FieldValues>(initialValues ?? emptyValues);
  const [detailRows, setDetailRows] = useState<DetailRow[]>(initialDetailRows ?? []);
  const nextRowId = useRef(0);

  function addDetailRow() {
    nextRowId.current += 1;
    const id = String(nextRowId.current);
    setDetailRows((rows) => [
      ...rows,
      { id, itemText: "", itemId: "", quantityText: "", amount: "" },
    ]);
    setValues((v) => ({ ...v, amount: "" }));
  }

  const detailTotal = sumDetailAmounts(detailRows);
  const [showUtilityBillNotice, setShowUtilityBillNotice] = useState(false);
  const queryClient = useQueryClient();

  // 렌더 중 state 객체 참조 비교로 성공 시 폼 초기화(useEffect 캐스케이드 회피 — CLAUDE.md 컨벤션)
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") {
      setValues(emptyValues);
      setDetailRows([]);
      // updateExpenseAction/addExpenseAction의 revalidatePath는 서버(RSC) 캐시만 무효화한다 —
      // 지출 내역 목록(ExpensesListClient)은 React Query로 별도 클라이언트 캐시를 갖고 있어
      // (DeleteExpenseButton과 동일한 이유) 여기서 직접 invalidate하지 않으면 staleTime(30초)
      // 동안 수정 전 값이 목록에 그대로 남아 보인다(2026-07-19 PM 실사용 중 발견 — 지출일 수정
      // 후 목록에서 옛 날짜가 보이던 버그).
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: ["expenses-offset"] });
        queryClient.invalidateQueries({ queryKey: ["expenses-cursor"] });
      });
      if (isEditMode && isUtilityBill) {
        // 알림 팝업을 확인(닫기)한 뒤에야 onSuccess(페이지 이동/팝업 닫기)를 호출 —
        // 먼저 이동/닫힘이 일어나면 이 알림도 같이 사라져 사용자가 못 볼 수 있다.
        setShowUtilityBillNotice(true);
      } else if (onSuccess) {
        // onSuccess는 보통 부모(다른 컴포넌트)의 state를 바꾸는 콜백이라, 이 렌더 안에서 바로
        // 호출하면 "다른 컴포넌트를 렌더링 중에 업데이트" 경고가 발생함 — 현재 렌더 호출스택이
        // 끝난 뒤로 미룸.
        queueMicrotask(onSuccess);
      }
    }
  }

  const errors = state.status === "validation_error" ? state.errors : {};

  const formRef = useRef<HTMLFormElement>(null);
  // 상세항목을 여러 개 입력해 폼이 길어진 상태에서 검증에 실패하면, 화면 위쪽 필드(지출분류/지출항목 등)의
  // 에러 문구가 스크롤 밖에 있어 눈에 안 띌 수 있음 — 폼 순서상 가장 위에 있는 에러 필드로 자동 포커스
  // 이동시켜(브라우저 기본 동작으로 스크롤도 함께 됨) 사용자가 직접 스크롤해서 찾지 않아도 되게 한다.
  useEffect(() => {
    if (state.status !== "validation_error" || !formRef.current) return;

    const fieldOrder = [
      "occurredAt",
      "paymentMethodId",
      "categoryId",
      "vendorName",
      "amount",
      "details",
      "memo",
    ] as const;
    const firstErrorField = fieldOrder.find((field) => state.errors[field]?.length);
    if (!firstErrorField) return;

    // amount는 실제 제출값을 담는 input이 name="amount" hidden이라 포커스가 안 되므로 화면에 보이는
    // 짝(id="amount-visible")을 대신 타겟팅, details는 필드별이 아니라 배열 전체 에러라 상세항목
    // 섹션의 첫 번째 행 품목명 입력으로 이동.
    const selector =
      firstErrorField === "amount"
        ? "#amount-visible"
        : firstErrorField === "details"
          ? '[name="detailItemText"]'
          : `[name="${firstErrorField}"]`;
    formRef.current.querySelector<HTMLElement>(selector)?.focus();
  }, [state]);

  return (
    <>
      <form ref={formRef} action={formAction} className="space-y-4">
        {isEditMode && <input type="hidden" name="id" value={transactionId} />}
        <input type="hidden" name="hasDetail" value={detailRows.length > 0 ? "true" : "false"} />
        {state.status === "error" && (
          <p className="text-sm font-medium text-[var(--paylens-accent)]">{state.message}</p>
        )}
        {state.status === "success" && (
          <p className="text-sm font-medium text-[var(--paylens-action)]">저장되었습니다</p>
        )}

        <div>
          <FieldLabel>날짜</FieldLabel>
          <input
            name="occurredAt"
            type="date"
            value={values.occurredAt}
            onChange={(e) => setValues({ ...values, occurredAt: e.target.value })}
            className={inputClassName}
          />
          <FieldError messages={errors.occurredAt} />
        </div>

        <div>
          <FieldLabel>지출분류</FieldLabel>
          <PaymentMethodSelect
            paymentMethods={paymentMethods}
            value={values.paymentMethodId}
            onChange={(v) => setValues({ ...values, paymentMethodId: v })}
            syncToken={state}
          />
          <FieldError messages={errors.paymentMethodId} />
        </div>

        <div>
          <FieldLabel>지출항목</FieldLabel>
          <CategorySelect
            categories={categories}
            value={values.categoryId}
            onChange={(v) => setValues({ ...values, categoryId: v })}
            syncToken={state}
          />
          <FieldError messages={errors.categoryId} />
        </div>

        <div>
          <FieldLabel>지출처</FieldLabel>
          <VendorCombobox
            vendors={vendors}
            value={values.vendorName}
            onChange={(v) => setValues({ ...values, vendorName: v })}
          />
          <FieldError messages={errors.vendorName} />
        </div>

        {detailRows.length === 0 ? (
          <div>
            <div className="flex items-baseline justify-between">
              <FieldLabel>금액</FieldLabel>
              <button
                type="button"
                onClick={addDetailRow}
                className="mb-1.5 text-xs font-medium text-[var(--paylens-action)] hover:underline"
              >
                +상세항목
              </button>
            </div>
            <AmountInput
              id="amount-visible"
              name="amount"
              value={values.amount}
              onChange={(v) => setValues({ ...values, amount: v })}
              placeholder="0"
              className={`${inputClassName} font-mono`}
            />
            <FieldError messages={errors.amount} />
          </div>
        ) : (
          <div>
            <FieldLabel>상세항목</FieldLabel>
            <DetailItemRows
              rows={detailRows}
              items={items}
              units={units}
              onChange={setDetailRows}
            />
            <FieldError messages={errors.details} />
            <button
              type="button"
              onClick={addDetailRow}
              className="mt-2 text-xs font-medium text-[var(--paylens-action)] hover:underline"
            >
              + 항목 추가
            </button>
            <div className="mt-3">
              <FieldLabel>금액 (상세항목 합계, 자동계산)</FieldLabel>
              <input
                type="text"
                readOnly
                value={detailTotal.toLocaleString("ko-KR")}
                className={`${inputClassName} cursor-not-allowed bg-[var(--paylens-bg)] font-mono`}
              />
            </div>
          </div>
        )}

        <div>
          <div className="flex items-baseline justify-between">
            <FieldLabel>비고</FieldLabel>
            <span
              className={`mb-1.5 text-xs ${
                values.memo.length > MEMO_MAX_LENGTH
                  ? "font-semibold text-[var(--paylens-accent)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
            >
              {values.memo.length.toLocaleString("ko-KR")}/{MEMO_MAX_LENGTH.toLocaleString("ko-KR")}
              자
            </span>
          </div>
          <textarea
            name="memo"
            rows={3}
            maxLength={MEMO_MAX_LENGTH}
            value={values.memo}
            onChange={(e) => setValues({ ...values, memo: e.target.value })}
            placeholder="메모를 입력해 주세요 (선택)"
            className={`${inputClassName} h-auto resize-none py-2`}
          />
          <FieldError messages={errors.memo} />
        </div>

        <div className="flex gap-2 border-t border-[#e2e8f0] pt-4">
          <button
            type="submit"
            disabled={isPending}
            className="h-10 flex-1 rounded-lg bg-[var(--paylens-action)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "저장 중…" : isEditMode ? "수정" : "저장"}
          </button>
          {secondaryActions}
        </div>
      </form>
      <SuccessDialog
        open={showUtilityBillNotice}
        onOpenChange={(open) => {
          setShowUtilityBillNotice(open);
          if (!open && onSuccess) queueMicrotask(onSuccess);
        }}
        message="이 지출은 관리비 명세서로 등록되었습니다. 금액을 수정해도 항목별 통계는 원본 그대로 유지됩니다."
      />
    </>
  );
}
