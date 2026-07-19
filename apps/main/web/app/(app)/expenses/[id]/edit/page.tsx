import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { buildFormValuesFromTransaction } from "@/lib/expense-form-values";
import { sanitizeExpenseListHref } from "@/lib/expense-list-href";
import { EditExpenseFormClient } from "./EditExpenseFormClient";

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const listHref = sanitizeExpenseListHref(from);
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
    { data: utilityBillRecord },
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
    // [F-2-4-1] 관리비 명세서 업로드로 등록된 트랜잭션인지 판별(안내 배너용).
    supabase.from("utility_bill_record").select("id").eq("transaction_id", id).maybeSingle(),
  ]);

  // RLS 조건에 안 걸리면(남의 것/삭제됨) 조회 결과가 없음 — 존재하지 않는 것과 동일하게 취급.
  if (!transaction) redirect("/expenses");

  const unitNameById = new Map((units ?? []).map((u) => [u.id, u.name]));
  const { initialValues, initialDetailRows } = buildFormValuesFromTransaction(
    transaction,
    unitNameById
  );

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">지출 수정</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            지출 내역을 수정하거나 삭제하세요
          </p>
        </div>

        {utilityBillRecord && (
          <div className="rounded-lg border border-[var(--paylens-action)] bg-[var(--paylens-action)]/5 p-3 text-sm text-[var(--color-text-primary)]">
            이 지출은 관리비 명세서로 등록되었습니다. 금액을 수정해도 항목별 통계는 원본 그대로
            유지됩니다.
          </div>
        )}

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <EditExpenseFormClient
            paymentMethods={paymentMethods ?? []}
            categories={categories ?? []}
            vendors={vendors ?? []}
            items={items ?? []}
            units={units ?? []}
            transactionId={transaction.id}
            initialValues={initialValues}
            initialDetailRows={initialDetailRows}
            listHref={listHref}
          />
        </section>
      </div>
    </div>
  );
}
