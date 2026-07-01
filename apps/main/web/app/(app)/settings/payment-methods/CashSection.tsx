"use client";

import { useActionState, useState } from "react";
import type { Database } from "@account-books/types";
import { updateDisplayNameAction, type PaymentMethodActionState } from "./actions";

type PaymentMethod = Database["public"]["Tables"]["payment_method"]["Row"];

const initialState: PaymentMethodActionState = { status: "idle" };

export function CashSection({ cash }: { cash: PaymentMethod }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateDisplayNameAction, initialState);
  // 검증 실패 시에도 입력값이 원래대로 리셋되지 않도록 제어 컴포넌트로 유지
  const [displayName, setDisplayName] = useState(cash.display_name);

  // 렌더 중 state 객체 참조 비교로 편집모드 닫기(React 공식 패턴) — useEffect의 setState 캐스케이드 회피.
  // status 값이 아니라 객체 참조로 비교해야 연속 성공 제출도 매번 감지된다.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setEditing(false);
  }

  const errors = state.status === "validation_error" ? state.errors : {};

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--color-text-primary)]">{cash.display_name}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
        >
          이름 수정
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={cash.id} />
      {state.status === "error" && (
        <p className="text-sm font-medium text-[var(--paylens-accent)]">{state.message}</p>
      )}
      <div className="flex items-center gap-2">
        <input
          name="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoFocus
          className={`h-10 flex-1 rounded-lg border px-3.5 text-sm outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.displayName ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-lg bg-[var(--paylens-action)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="h-10 rounded-lg px-3 text-sm text-[var(--color-text-secondary)] hover:underline"
        >
          취소
        </button>
      </div>
      {errors.displayName && (
        <p className="text-xs text-[var(--paylens-accent)]">{errors.displayName[0]}</p>
      )}
    </form>
  );
}
