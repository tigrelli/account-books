"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { budgetAmountSchema, periodRegex, CATEGORY_FIELD_PREFIX } from "@/lib/budget-schemas";

const PATH = "/budgets";
const OVER_TOTAL_MESSAGE = "전체 예산을 초과하였습니다. 전체 예산을 확인하세요.";

export type BudgetActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

// 전체 예산 + 카테고리별 예산을 한 화면/한 번의 제출로 함께 저장한다(2026-07-03 PM 결정 —
// 항목마다 따로 등록 버튼을 두지 않고, 화면 전체를 하나의 폼으로 취급). 각 금액 필드가
// 비어있거나 "0"이면 "예산 없음"으로 간주해 해당 행을 삭제한다(0을 그대로 저장하지 않음 —
// DB CHECK 제약이 limit_amount > 0이기도 하고, "미설정"과 "0원 예산"을 구분할 이유가 없음).
export async function saveBudgetsAction(
  period: string,
  _prev: BudgetActionState,
  formData: FormData
): Promise<BudgetActionState> {
  if (!periodRegex.test(period)) return { status: "error", message: "잘못된 요청입니다" };

  const totalParsed = budgetAmountSchema.safeParse(formData.get("totalAmount"));
  if (!totalParsed.success) {
    return { status: "error", message: "전체 예산 금액을 확인해 주세요." };
  }
  const totalAmount = Number(totalParsed.data || "0");

  const categoryAmounts: { categoryId: string; amount: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(CATEGORY_FIELD_PREFIX)) continue;
    const parsed = budgetAmountSchema.safeParse(value);
    if (!parsed.success) {
      return { status: "error", message: "카테고리별 예산 금액을 확인해 주세요." };
    }
    categoryAmounts.push({
      categoryId: key.slice(CATEGORY_FIELD_PREFIX.length),
      amount: Number(parsed.data || "0"),
    });
  }

  const categoryTotal = categoryAmounts.reduce((sum, c) => sum + c.amount, 0);
  if (totalAmount > 0 && categoryTotal > totalAmount) {
    return { status: "error", message: OVER_TOTAL_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "로그인이 필요합니다" };

  // 전체 예산을 0(=미설정)으로 저장 → 카테고리별 예산도 근거를 잃으므로 함께 삭제.
  // 실패해도 안전한 순서: 카테고리를 먼저 지우고(실패해도 "카테고리 미설정" 상태라 정상),
  // 전체 예산을 마지막에 지운다(item-merge.ts와 동일한 원칙).
  if (totalAmount === 0) {
    const { error: categoryDeleteError } = await supabase
      .from("budget")
      .delete()
      .eq("user_id", user.id)
      .eq("period", period);
    if (categoryDeleteError) return { status: "error", message: "예산 저장에 실패했습니다" };

    const { error: totalDeleteError } = await supabase
      .from("budget_total")
      .delete()
      .eq("user_id", user.id)
      .eq("period", period);
    if (totalDeleteError) return { status: "error", message: "예산 저장에 실패했습니다" };

    revalidatePath(PATH);
    return { status: "success" };
  }

  // 전체 예산을 먼저 확정한 뒤(카테고리별 예산이 기댈 앵커) 카테고리별 예산을 반영한다.
  const { error: totalError } = await supabase
    .from("budget_total")
    .upsert(
      { user_id: user.id, period, limit_amount: totalAmount },
      { onConflict: "user_id,period" }
    );
  if (totalError) return { status: "error", message: "예산 저장에 실패했습니다" };

  const toDelete = categoryAmounts.filter((c) => c.amount === 0).map((c) => c.categoryId);
  const toUpsert = categoryAmounts.filter((c) => c.amount > 0);

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("budget")
      .delete()
      .eq("user_id", user.id)
      .eq("period", period)
      .in("category_id", toDelete);
    if (error) return { status: "error", message: "예산 저장에 실패했습니다" };
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase.from("budget").upsert(
      toUpsert.map((c) => ({
        user_id: user.id,
        category_id: c.categoryId,
        period,
        limit_amount: c.amount,
      })),
      { onConflict: "user_id,category_id,period" }
    );
    if (error) return { status: "error", message: "예산 저장에 실패했습니다" };
  }

  revalidatePath(PATH);
  return { status: "success" };
}
