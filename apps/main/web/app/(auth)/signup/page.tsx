"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUpAction, type SignUpState } from "./actions";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const initialState: SignUpState = { status: "idle" };

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);
  // React는 form action 제출 후 비제어(uncontrolled) 입력을 자동으로 리셋한다.
  // 이름/이메일은 검증 실패(예: 비밀번호 불일치) 시에도 값을 유지해야 하므로 제어 컴포넌트로 전환.
  // 비밀번호 필드는 의도적으로 비제어 상태로 남겨 매 제출마다 리셋되게 한다.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  if (state.status === "success") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--paylens-action)]/10">
          <svg
            className="h-7 w-7 text-[var(--paylens-action)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-bold text-[var(--color-text-primary)]">
          가입이 완료되었습니다
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          <span className="font-semibold text-[var(--color-text-primary)]">{state.email}</span>
          으로 로그인해서 이용해 보세요.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--paylens-action)] text-sm font-semibold text-white transition-colors hover:bg-[#0f766e] active:bg-[#0d6b63]"
        >
          로그인하기
        </Link>
      </div>
    );
  }

  const errors = state.status === "validation_error" ? state.errors : {};

  return (
    <>
      <h1 className="mb-1 text-xl font-bold text-[var(--color-text-primary)]">회원가입</h1>
      <p className="mb-7 text-sm text-[var(--color-text-secondary)]">
        payLens 계정을 만들어 지출을 관리하세요
      </p>

      {state.status === "error" && (
        <div className="mb-5 rounded-lg border border-[var(--paylens-accent)]/20 bg-[var(--paylens-accent)]/8 px-4 py-3 text-sm font-medium text-[var(--paylens-accent)]">
          {state.message}
        </div>
      )}

      <form action={formAction} noValidate className="space-y-5">
        {/* 이름 */}
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
            autoComplete="name"
            placeholder="홍길동"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`h-11 w-full rounded-lg border px-3.5 text-sm transition-colors outline-none placeholder:text-[var(--color-text-secondary)]/50 focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.name ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
          />
          {errors.name && (
            <p className="mt-1.5 text-xs text-[var(--paylens-accent)]">{errors.name[0]}</p>
          )}
        </div>

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
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-semibold text-[var(--color-text-primary)]"
          >
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="8자 이상"
            className={`h-11 w-full rounded-lg border px-3.5 text-sm transition-colors outline-none placeholder:text-[var(--color-text-secondary)]/50 focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.password ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
          />
          {errors.password && (
            <p className="mt-1.5 text-xs text-[var(--paylens-accent)]">{errors.password[0]}</p>
          )}
        </div>

        {/* 비밀번호 확인 */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-semibold text-[var(--color-text-primary)]"
          >
            비밀번호 확인
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="비밀번호 재입력"
            className={`h-11 w-full rounded-lg border px-3.5 text-sm transition-colors outline-none placeholder:text-[var(--color-text-secondary)]/50 focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.confirmPassword ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
          />
          {errors.confirmPassword && (
            <p className="mt-1.5 text-xs text-[var(--paylens-accent)]">
              {errors.confirmPassword[0]}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 h-11 w-full rounded-lg bg-[var(--paylens-action)] text-sm font-semibold text-white transition-colors hover:bg-[#0f766e] active:bg-[#0d6b63] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "처리 중…" : "회원가입"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#e2e8f0]" />
        <span className="text-xs text-[var(--color-text-secondary)]">또는</span>
        <div className="h-px flex-1 bg-[#e2e8f0]" />
      </div>

      <GoogleSignInButton label="Google로 계속하기" />

      <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-semibold text-[var(--paylens-action)] hover:underline">
          로그인
        </Link>
      </p>
    </>
  );
}
