"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  // 이메일은 검증/인증 실패 후에도 값을 유지해야 하므로 제어 컴포넌트로 전환.
  // 비밀번호는 의도적으로 비제어 상태로 남겨 매 제출마다 리셋되게 한다.
  const [email, setEmail] = useState("");

  const errors = state.status === "validation_error" ? state.errors : {};

  return (
    <>
      <h1 className="mb-1 text-xl font-bold text-[var(--color-text-primary)]">로그인</h1>
      <p className="mb-7 text-sm text-[var(--color-text-secondary)]">
        payLens에 오신 것을 환영합니다
      </p>

      {state.status === "error" && (
        <div className="mb-5 rounded-lg border border-[var(--paylens-accent)]/20 bg-[var(--paylens-accent)]/8 px-4 py-3 text-sm font-medium text-[var(--paylens-accent)]">
          {state.message}
        </div>
      )}

      <form action={formAction} noValidate className="space-y-5">
        {/* 이메일 */}
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-semibold text-[var(--color-text-primary)]"
          >
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`h-11 w-full rounded-lg border px-3.5 text-sm transition-colors outline-none placeholder:text-[var(--color-text-secondary)]/50 focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.email ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
          />
          {errors.email && (
            <p className="mt-1.5 text-xs text-[var(--paylens-accent)]">{errors.email[0]}</p>
          )}
        </div>

        {/* 비밀번호 */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-[var(--color-text-primary)]"
            >
              비밀번호
            </label>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호 입력"
            className={`h-11 w-full rounded-lg border px-3.5 text-sm transition-colors outline-none placeholder:text-[var(--color-text-secondary)]/50 focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.password ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
          />
          {errors.password && (
            <p className="mt-1.5 text-xs text-[var(--paylens-accent)]">{errors.password[0]}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 h-11 w-full rounded-lg bg-[var(--paylens-action)] text-sm font-semibold text-white transition-colors hover:bg-[#0f766e] active:bg-[#0d6b63] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "로그인 중…" : "로그인"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="font-semibold text-[var(--paylens-action)] hover:underline">
          회원가입
        </Link>
      </p>
    </>
  );
}
