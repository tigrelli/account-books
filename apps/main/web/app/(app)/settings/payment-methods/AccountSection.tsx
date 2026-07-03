"use client";

import { useActionState, useState, useTransition } from "react";
import type { Database } from "@account-books/types";
import {
  addAccountAction,
  updateDisplayNameAction,
  setActiveAction,
  type PaymentMethodActionState,
} from "./actions";

type PaymentMethod = Database["public"]["Tables"]["payment_method"]["Row"];

const initialState: PaymentMethodActionState = { status: "idle" };

function AccountRow({ account }: { account: PaymentMethod }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateDisplayNameAction, initialState);
  const [isToggling, startToggle] = useTransition();
  // 검증 실패 시에도 입력값이 원래대로 리셋되지 않도록 제어 컴포넌트로 유지
  const [displayName, setDisplayName] = useState(account.display_name);

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
        <input type="hidden" name="id" value={account.id} />
        <div className="flex items-center gap-2">
          <input
            name="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoFocus
            className={`h-9 flex-1 rounded-lg border px-3 text-sm outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.displayName ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
          />
          <button
            type="submit"
            disabled={isPending}
            className="h-9 rounded-lg bg-[var(--paylens-action)] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "저장 중…" : "저장"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-9 rounded-lg px-2 text-xs text-[var(--color-text-secondary)] hover:underline"
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

  return (
    <div
      className={`flex items-center justify-between rounded-lg border border-[#e2e8f0] p-3 ${account.is_active ? "" : "opacity-50"}`}
    >
      <span className="text-sm text-[var(--color-text-primary)]">{account.display_name}</span>
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
          onClick={() => startToggle(() => setActiveAction(account.id, !account.is_active))}
          className="text-xs font-medium text-[var(--color-text-secondary)] hover:underline"
        >
          {account.is_active ? "비활성화" : "활성화"}
        </button>
      </div>
    </div>
  );
}

function AddAccountForm() {
  const [state, formAction, isPending] = useActionState(addAccountAction, initialState);
  // 검증 실패 시에도 입력값이 리셋되지 않도록 제어 컴포넌트로 유지, 등록 성공 시에만 비움
  const [displayName, setDisplayName] = useState("");

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setDisplayName("");
  }

  const errors = state.status === "validation_error" ? state.errors : {};

  return (
    <form action={formAction} className="space-y-1.5">
      {state.status === "error" && (
        <p className="text-sm font-medium text-[var(--paylens-accent)]">{state.message}</p>
      )}
      <div className="flex items-center gap-2">
        <input
          name="displayName"
          type="text"
          placeholder="예: 신한은행 통장"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={`h-10 flex-1 rounded-lg border px-3.5 text-sm outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.displayName ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-10 shrink-0 rounded-lg bg-[var(--paylens-action)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "등록 중…" : "등록"}
        </button>
      </div>
      {errors.displayName && (
        <p className="text-xs text-[var(--paylens-accent)]">{errors.displayName[0]}</p>
      )}
    </form>
  );
}

export function AccountSection({ accounts }: { accounts: PaymentMethod[] }) {
  return (
    <div className="space-y-3">
      {accounts.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">등록된 계좌가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <AccountRow key={account.id} account={account} />
          ))}
        </div>
      )}
      <AddAccountForm />
    </div>
  );
}
