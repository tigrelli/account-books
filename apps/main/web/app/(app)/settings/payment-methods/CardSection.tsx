"use client";

import { useActionState, useState, useTransition } from "react";
import type { Database } from "@account-books/types";
import {
  addCardAction,
  updateCardAction,
  setActiveAction,
  type PaymentMethodActionState,
} from "./actions";

type PaymentMethod = Database["public"]["Tables"]["payment_method"]["Row"];

const initialState: PaymentMethodActionState = { status: "idle" };

const cardKindLabel: Record<string, string> = {
  CHECK: "체크카드",
  CREDIT: "신용카드",
};

// 2026-07-03 PM 결정: "카드 별칭"과 "카드사"를 별도로 입력받던 것을 하나로 합침 — 이제 "카드사명"
// 한 칸만 입력받아 그대로 displayName(표시명)으로 저장. card_issuer 컬럼은 삭제하지 않고 항상 null로 유지.
type CardFieldValues = { displayName: string; cardKind: string };

function CardFields({
  errors,
  values,
  onChange,
  trailingButton,
}: {
  errors: Partial<Record<string, string[]>>;
  values: CardFieldValues;
  onChange: (values: CardFieldValues) => void;
  // 등록 폼에서만 카드사명/종류와 같은 줄에 "등록" 버튼을 넣기 위한 슬롯 — 수정 폼(CardRow)은 아래에
  // "취소"/"저장" 버튼을 별도 줄로 두는 기존 레이아웃을 유지하므로 비워둠.
  trailingButton?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex gap-2">
        <input
          name="displayName"
          type="text"
          placeholder="카드사명 (예: 국민카드)"
          value={values.displayName}
          onChange={(e) => onChange({ ...values, displayName: e.target.value })}
          className={`h-10 min-w-0 flex-1 rounded-lg border px-3.5 text-sm outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.displayName ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
        />
        <select
          name="cardKind"
          value={values.cardKind}
          onChange={(e) => onChange({ ...values, cardKind: e.target.value })}
          className={`h-10 shrink-0 rounded-lg border bg-white px-2 text-sm outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.cardKind ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
        >
          <option value="CHECK">체크</option>
          <option value="CREDIT">신용</option>
        </select>
        {trailingButton}
      </div>
      {(errors.displayName || errors.cardKind) && (
        <p className="text-xs text-[var(--paylens-accent)]">
          {errors.displayName?.[0] ?? errors.cardKind?.[0]}
        </p>
      )}
    </>
  );
}

function CardRow({ card }: { card: PaymentMethod }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateCardAction, initialState);
  const [isToggling, startToggle] = useTransition();
  // 검증 실패 시에도 입력값이 원래대로 리셋되지 않도록 제어 컴포넌트로 유지
  const [values, setValues] = useState<CardFieldValues>({
    displayName: card.display_name,
    cardKind: card.card_kind ?? "",
  });

  // 렌더 중 state 객체 참조 비교로 편집모드 닫기(React 공식 패턴) — useEffect의 setState 캐스케이드 회피.
  // status 값이 아니라 객체 참조로 비교해야 연속 성공 제출도 매번 감지된다.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setEditing(false);
  }

  const errors = state.status === "validation_error" ? state.errors : {};

  if (editing) {
    return (
      <form action={formAction} className="space-y-1.5 rounded-lg border border-[#e2e8f0] p-3">
        <input type="hidden" name="id" value={card.id} />
        <CardFields errors={errors} values={values} onChange={setValues} />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-9 rounded-lg px-2 text-xs text-[var(--color-text-secondary)] hover:underline"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="h-9 rounded-lg bg-[var(--paylens-action)] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div
      className={`flex items-center justify-between rounded-lg border border-[#e2e8f0] p-3 ${card.is_active ? "" : "opacity-50"}`}
    >
      <div>
        <p className="text-sm text-[var(--color-text-primary)]">{card.display_name}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {card.card_issuer ? `${card.card_issuer} · ` : ""}
          {cardKindLabel[card.card_kind ?? ""] ?? card.card_kind}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-[var(--paylens-action)] hover:underline"
        >
          수정
        </button>
        <button
          type="button"
          disabled={isToggling}
          onClick={() => startToggle(() => setActiveAction(card.id, !card.is_active))}
          className="text-xs font-medium text-[var(--color-text-secondary)] hover:underline"
        >
          {card.is_active ? "비활성화" : "활성화"}
        </button>
      </div>
    </div>
  );
}

// 카드 등록 시 "종류" 미선택 placeholder를 없애는 대신 신용을 기본값으로 선택해 둠(PM 결정).
const emptyCardValues: CardFieldValues = { displayName: "", cardKind: "CREDIT" };

function AddCardForm() {
  const [state, formAction, isPending] = useActionState(addCardAction, initialState);
  // 검증 실패 시에도 입력값이 리셋되지 않도록 제어 컴포넌트로 유지, 등록 성공 시에만 비움
  const [values, setValues] = useState<CardFieldValues>(emptyCardValues);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setValues(emptyCardValues);
  }

  const errors = state.status === "validation_error" ? state.errors : {};

  return (
    <form action={formAction} className="space-y-1.5">
      {state.status === "error" && (
        <p className="text-sm font-medium text-[var(--paylens-accent)]">{state.message}</p>
      )}
      <CardFields
        errors={errors}
        values={values}
        onChange={setValues}
        trailingButton={
          <button
            type="submit"
            disabled={isPending}
            className="h-10 shrink-0 rounded-lg bg-[var(--paylens-action)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "등록 중…" : "등록"}
          </button>
        }
      />
    </form>
  );
}

export function CardSection({ cards }: { cards: PaymentMethod[] }) {
  return (
    <div className="space-y-3">
      {cards.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">등록된 카드가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => (
            <CardRow key={card.id} card={card} />
          ))}
        </div>
      )}
      <AddCardForm />
    </div>
  );
}
