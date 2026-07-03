import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { VendorSection } from "./VendorSection";

export default async function VendorsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: vendors } = await supabase
    .from("vendor")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <Link href="/settings" className="text-sm text-[var(--paylens-action)] hover:underline">
            ← 계정 설정으로
          </Link>
          <h1 className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">지출처 관리</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            자주 쓰는 지출처를 등록하고 관리하세요
          </p>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <VendorSection vendors={vendors ?? []} />
        </section>
      </div>
    </div>
  );
}
