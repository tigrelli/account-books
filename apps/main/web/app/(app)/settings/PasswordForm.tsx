"use client";

import { useActionState } from "react";
import { updatePasswordAction, type PasswordState } from "./actions";

const initialState: PasswordState = { status: "idle" };

export function PasswordForm() {
  const [state, formAction, isPending] = useActionState(updatePasswordAction, initialState);

  const errors = state.status === "validation_error" ? state.errors : {};

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "success" && (
        <p className="text-sm font-medium text-[var(--paylens-action)]">
          비밀번호가 변경되었습니다
        </p>
      )}
      {state.status === "error" && (
        <p className="text-sm font-medium text-[var(--paylens-accent)]">{state.message}</p>
      )}

      <div>
        <label
          htmlFor="newPassword"
          className="mb-1.5 block text-sm font-semibold text-[var(--color-text-primary)]"
        >
          새 비밀번호
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="8자 이상"
          className={`h-11 w-full rounded-lg border px-3.5 text-sm transition-colors outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.newPassword ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
        />
        {errors.newPassword && (
          <p className="mt-1.5 text-xs text-[var(--paylens-accent)]">{errors.newPassword[0]}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1.5 block text-sm font-semibold text-[var(--color-text-primary)]"
        >
          새 비밀번호 확인
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호 재입력"
          className={`h-11 w-full rounded-lg border px-3.5 text-sm transition-colors outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.confirmPassword ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
        />
        {errors.confirmPassword && (
          <p className="mt-1.5 text-xs text-[var(--paylens-accent)]">{errors.confirmPassword[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="h-10 rounded-lg bg-[var(--paylens-action)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0f766e] active:bg-[#0d6b63] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "변경 중…" : "비밀번호 변경"}
      </button>
    </form>
  );
}
