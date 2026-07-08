import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 구글 로그인(S-1-13)은 display_name이 아니라 full_name/name 클레임으로 이름을 채워준다 —
  // 이메일 가입과 필드명이 달라 폴백 없인 구글로 가입한 사용자의 이름란이 빈 채로 보인다.
  const metadata = user.user_metadata as Record<string, string | undefined> | undefined;
  const displayName = metadata?.display_name ?? metadata?.full_name ?? metadata?.name ?? "";

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">계정 설정</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{user.email}</p>
        </div>

        {/* 프로필 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[var(--color-text-primary)]">프로필</h2>
          <ProfileForm initialName={displayName} />
        </section>

        {/* 비밀번호 변경 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[var(--color-text-primary)]">비밀번호 변경</h2>
          <PasswordForm />
        </section>

        {/* 지출분류 관리 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">지출분류 관리</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                현금, 계좌, 카드를 등록하고 관리하세요
              </p>
            </div>
            <Link
              href="/settings/payment-methods"
              prefetch={false}
              className="text-sm font-semibold text-[var(--paylens-action)] hover:underline"
            >
              관리하기 →
            </Link>
          </div>
        </section>

        {/* 지출항목 관리 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">지출항목 관리</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                지출 항목을 등록하고 관리하세요
              </p>
            </div>
            <Link
              href="/settings/categories"
              prefetch={false}
              className="text-sm font-semibold text-[var(--paylens-action)] hover:underline"
            >
              관리하기 →
            </Link>
          </div>
        </section>

        {/* 지출처 관리 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">지출처 관리</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                자주 쓰는 지출처를 등록하고 관리하세요
              </p>
            </div>
            <Link
              href="/settings/vendors"
              prefetch={false}
              className="text-sm font-semibold text-[var(--paylens-action)] hover:underline"
            >
              관리하기 →
            </Link>
          </div>
        </section>

        {/* 품목 관리 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">품목 관리</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                지출 입력으로 쌓인 상세항목(품목)을 확인하세요
              </p>
            </div>
            <Link
              href="/settings/items"
              prefetch={false}
              className="text-sm font-semibold text-[var(--paylens-action)] hover:underline"
            >
              관리하기 →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
