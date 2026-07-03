"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Database, Json } from "@account-books/types";
import { addExpenseAction, updateExpenseAction, type ExpenseActionState } from "./actions";
import { parseQuantityText } from "@/lib/quantity-parse";
import { sumDetailAmounts } from "@/lib/expense-calculations";
import { formatPaymentMethodLabel } from "@/lib/payment-method-format";

type PaymentMethod = Database["public"]["Tables"]["payment_method"]["Row"];
type Category = Database["public"]["Tables"]["category"]["Row"];
type Vendor = Database["public"]["Tables"]["vendor"]["Row"];
type Item = Database["public"]["Tables"]["item"]["Row"];
type Unit = Database["public"]["Tables"]["unit"]["Row"];

// aliases는 jsonb라 타입상 Json — 자동완성 매칭 전 문자열 배열로만 좁혀 사용.
function itemAliasesToArray(aliases: Json): string[] {
  return Array.isArray(aliases) ? aliases.filter((a): a is string => typeof a === "string") : [];
}

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

function eunOrNeun(word: string): "은" | "는" {
  return hasBatchim(word) ? "은" : "는";
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

function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputClassName =
  "h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15";

const initialState: ExpenseActionState = { status: "idle" };

type FieldValues = {
  occurredAt: string;
  paymentMethodId: string;
  categoryId: string;
  vendorName: string;
  amount: string;
};

const emptyValues: FieldValues = {
  occurredAt: todayDateInputValue(),
  paymentMethodId: "",
  categoryId: "",
  vendorName: "",
  amount: "",
};

// 상세항목은 아직 서버로 제출되지 않는 UI 전용 상태 — 저장 연동은 F-1-5-6~11에서 처리.
// itemId: 자동완성으로 기존 Item을 선택한 경우만 채워짐. 빈 문자열이면 자유 입력(신규 후보) 상태.
type DetailRow = {
  id: string;
  itemText: string;
  itemId: string;
  quantityText: string;
  amount: string;
};

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
  name,
  value,
  onChange,
  placeholder,
  className,
}: {
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

// 동적 행 추가/삭제(F-1-5-4) + 품목 자동완성(F-1-5-5) + 신규 Item 안내(F-1-5-6) + 유사항목 제안(F-1-5-7)
// + 수량/단위 파싱 미리보기(F-1-5-8) + 단위 마스터 매칭/신규 단위 안내(F-1-5-9). 실제 저장은 actions.ts(F-1-5-11).
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
        // 구조화에 성공하고 단위 텍스트가 있는데 UNIT 마스터(시스템 기본+내 커스텀)에 없으면 신규 단위 후보로 안내.
        const newUnitText =
          parsedQuantity?.unitText &&
          !units.some((u) => u.name.toLowerCase() === parsedQuantity.unitText.toLowerCase())
            ? parsedQuantity.unitText
            : null;

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
                <input
                  name="detailQuantityText"
                  type="text"
                  placeholder="수량/단위 (선택, 예: 1개)"
                  value={row.quantityText}
                  onChange={(e) => updateRow(row.id, { quantityText: e.target.value })}
                  className={inputClassName}
                />
                <AmountInput
                  name="detailAmount"
                  value={row.amount}
                  onChange={(v) => updateRow(row.id, { amount: v })}
                  placeholder="금액"
                  className={`${inputClassName} font-mono`}
                />
              </div>
              {row.quantityText.trim().length > 0 && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {parsedQuantity
                    ? parsedQuantity.unitText
                      ? `→ 수량 ${parsedQuantity.value}, 단위 '${parsedQuantity.unitText}'`
                      : `→ 수량 ${parsedQuantity.value}`
                    : "→ 구조화 실패 — 입력한 원본 텍스트로 저장됩니다"}
                </p>
              )}
              {newUnitText && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  &apos;{newUnitText}&apos;{eunOrNeun(newUnitText)} 새 단위로 등록됩니다
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

  // 렌더 중 state 객체 참조 비교로 성공 시 폼 초기화(useEffect 캐스케이드 회피 — CLAUDE.md 컨벤션)
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") {
      setValues(emptyValues);
      setDetailRows([]);
    }
  }

  const errors = state.status === "validation_error" ? state.errors : {};

  return (
    <form action={formAction} className="space-y-4">
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
          <DetailItemRows rows={detailRows} items={items} units={units} onChange={setDetailRows} />
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

      <div className="border-t border-[#e2e8f0] pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="h-10 w-full rounded-lg bg-[var(--paylens-action)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "저장 중…" : isEditMode ? "수정하기" : "저장하기"}
        </button>
      </div>
    </form>
  );
}
