import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { ExpenseEntryForm } from "../../ExpenseEntryForm";
import { DeleteExpenseButton } from "./DeleteExpenseButton";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [
    { data: transaction },
    { data: paymentMethods },
    { data: categories },
    { data: vendors },
    { data: items },
    { data: units },
  ] = await Promise.all([
    supabase
      .from("transaction")
      .select("*, vendor(name), transaction_detail(*)")
      .eq("id", id)
      .maybeSingle(),
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
    supabase
      .from("unit")
      .select("*")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: true }),
  ]);

  // RLS 조건에 안 걸리면(남의 것/삭제됨) 조회 결과가 없음 — 존재하지 않는 것과 동일하게 취급.
  if (!transaction) redirect("/expenses");

  const unitNameById = new Map((units ?? []).map((u) => [u.id, u.name]));

  const initialValues = {
    occurredAt: transaction.occurred_at.slice(0, 10),
    paymentMethodId: transaction.payment_method_id,
    categoryId: transaction.category_id,
    vendorName: transaction.vendor?.name ?? "",
    amount: transaction.has_detail ? "" : String(transaction.amount),
  };

  const initialDetailRows = transaction.has_detail
    ? transaction.transaction_detail.map((d) => ({
        id: d.id,
        itemText: d.item_raw_text,
        itemId: d.item_id,
        quantityText:
          d.quantity_raw_text ??
          (d.quantity_value != null
            ? `${d.quantity_value}${unitNameById.get(d.unit_id ?? "") ?? ""}`
            : ""),
        amount: String(d.amount),
      }))
    : [];

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">지출 수정</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            지출 내역을 수정하거나 삭제하세요
          </p>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <ExpenseEntryForm
            paymentMethods={paymentMethods ?? []}
            categories={categories ?? []}
            vendors={vendors ?? []}
            items={items ?? []}
            units={units ?? []}
            transactionId={transaction.id}
            initialValues={initialValues}
            initialDetailRows={initialDetailRows}
          />
        </section>

        <div className="flex justify-center">
          <DeleteExpenseButton transactionId={transaction.id} />
        </div>
      </div>
    </div>
  );
}
