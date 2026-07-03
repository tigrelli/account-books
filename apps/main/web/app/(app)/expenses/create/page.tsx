import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { ExpenseEntryForm } from "../ExpenseEntryForm";

export default async function CreateExpensePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [
    { data: paymentMethods },
    { data: categories },
    { data: vendors },
    { data: items },
    { data: units },
  ] = await Promise.all([
    supabase
      .from("payment_method")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("category")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("vendor")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("item")
      .select("*")
      .is("merged_into_item_id", null)
      .order("created_at", { ascending: true }),
    // 시스템 기본 단위(user_id IS NULL) + 내가 등록한 커스텀 단위
    supabase
      .from("unit")
      .select("*")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">지출 입력</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            지출 내역을 입력하고 저장하세요
          </p>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <ExpenseEntryForm
            paymentMethods={paymentMethods ?? []}
            categories={categories ?? []}
            vendors={vendors ?? []}
            items={items ?? []}
            units={units ?? []}
          />
        </section>
      </div>
    </div>
  );
}
