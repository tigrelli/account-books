import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const displayName = (user.user_metadata?.display_name as string | undefined) ?? "";

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
      </div>
    </div>
  );
}
