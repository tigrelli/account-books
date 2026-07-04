import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { CashSection } from "./CashSection";
import { AccountSection } from "./AccountSection";
import { CardSection } from "./CardSection";

export default async function PaymentMethodsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: paymentMethods } = await supabase
    .from("payment_method")
    .select("*")
    .order("created_at", { ascending: true });

  const rows = paymentMethods ?? [];
  const cash = rows.find((r) => r.is_system_default) ?? null;
  const accounts = rows.filter((r) => r.type === "CASH" && !r.is_system_default);
  const cards = rows.filter((r) => r.type === "CARD");

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">지출분류 관리</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            현금, 계좌, 카드를 등록하고 관리하세요
          </p>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[var(--color-text-primary)]">현금</h2>
          {cash && <CashSection cash={cash} />}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[var(--color-text-primary)]">계좌</h2>
          <AccountSection accounts={accounts} />
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[var(--color-text-primary)]">카드</h2>
          <CardSection cards={cards} />
        </section>
      </div>
    </div>
  );
}
