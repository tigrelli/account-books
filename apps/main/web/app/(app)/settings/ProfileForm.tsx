"use client";

import { useActionState } from "react";
import { updateProfileAction, type ProfileState } from "./actions";

const initialState: ProfileState = { status: "idle" };

export function ProfileForm({ initialName }: { initialName: string }) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);

  const errors = state.status === "validation_error" ? state.errors : {};

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "success" && (
        <p className="text-sm font-medium text-[var(--paylens-action)]">
          프로필이 업데이트되었습니다
        </p>
      )}
      {state.status === "error" && (
        <p className="text-sm font-medium text-[var(--paylens-accent)]">{state.message}</p>
      )}

      <div>
        <label
          htmlFor="name"
          className="mb-1.5 block text-sm font-semibold text-[var(--color-text-primary)]"
        >
          이름
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={initialName}
          autoComplete="name"
          className={`h-11 w-full rounded-lg border px-3.5 text-sm transition-colors outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.name ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
        />
        {errors.name && (
          <p className="mt-1.5 text-xs text-[var(--paylens-accent)]">{errors.name[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="h-10 rounded-lg bg-[var(--paylens-action)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0f766e] active:bg-[#0d6b63] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}
