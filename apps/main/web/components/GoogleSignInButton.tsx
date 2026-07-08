import { signInWithGoogleAction } from "@/app/actions/auth";

// 구글 브랜드 가이드라인(흰 배경 + 테두리 + 공식 4색 G 로고)을 따름 — 사이트의 주 CTA 색(--paylens-action)을
// 쓰지 않는 게 의도적: OAuth 버튼은 사용자가 "이게 구글 로그인이구나"를 즉시 인지해야 하는 표준 패턴이라
// 브랜드 색을 입히면 오히려 신뢰도가 떨어진다.
export function GoogleSignInButton({ label }: { label: string }) {
  return (
    <form action={signInWithGoogleAction}>
      <button
        type="submit"
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-[#e2e8f0] bg-white text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--paylens-bg)]"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
          />
        </svg>
        {label}
      </button>
    </form>
  );
}
