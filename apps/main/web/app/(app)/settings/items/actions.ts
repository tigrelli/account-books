"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { aliasSchema } from "@/lib/item-schemas";
import { itemAliasesToArray, mergeAliases } from "@/lib/item-aliases";

const PATH = "/settings/items";

export type ItemActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

// itemId는 각 품목 행의 "별칭 추가" 폼마다 useActionState(addAliasAction.bind(null, item.id), ...)로
// 바인딩 — 품목이 여러 개라 CategoryRow처럼 hidden id input 하나로 통일하기보다 행별로 액션을 고정.
export async function addAliasAction(
  itemId: string,
  _prev: ItemActionState,
  formData: FormData
): Promise<ItemActionState> {
  const parsed = aliasSchema.safeParse({ alias: formData.get("alias") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "별칭을 확인해 주세요" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: item } = await supabase
    .from("item")
    .select("aliases")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { status: "error", message: "품목을 찾을 수 없습니다" };

  const current = itemAliasesToArray(item.aliases);
  const newAlias = parsed.data.alias;
  if (current.some((a) => a.toLowerCase() === newAlias.toLowerCase())) {
    return { status: "error", message: "이미 등록된 별칭입니다" };
  }

  const { error } = await supabase
    .from("item")
    .update({ aliases: [...current, newAlias] })
    .eq("id", itemId);

  if (error) return { status: "error", message: "별칭 추가에 실패했습니다" };

  revalidatePath(PATH);
  return { status: "success" };
}

// CategorySection의 setActiveAction과 동일하게 useActionState 없이 직접 호출하는 단순 서버 액션.
export async function removeAliasAction(itemId: string, alias: string) {
  const supabase = await createSupabaseServerClient();
  const { data: item } = await supabase
    .from("item")
    .select("aliases")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return;

  const updated = itemAliasesToArray(item.aliases).filter((a) => a !== alias);
  await supabase.from("item").update({ aliases: updated }).eq("id", itemId);
  revalidatePath(PATH);
}

// F-1-6-3 품목 병합 — sourceItemId를 targetItemId로 흡수. 확인(confirm)은 호출부(클라이언트)에서 처리.
// 순서가 중요: ① 상세항목(TRANSACTION_DETAIL) 재배정(과거 집계 재계산의 핵심 — item_id 기준 집계가
// 이 시점부터 바로 target 기준으로 정확해짐) → ② target 별칭에 source 이름/별칭 흡수(검색 연속성 유지)
// → ③ source에 merged_into_item_id 표시(마지막에 수행 — 중간에 실패해도 source가 활성 상태로 남아
// 재시도 가능하게). supabase-js가 멀티 스테이트먼트 트랜잭션을 지원하지 않아 완벽한 원자성은 아님
// (actions.ts의 상세입력 저장 로직과 동일한 알려진 한계).
export async function mergeItemAction(sourceItemId: string, targetItemId: string) {
  if (sourceItemId === targetItemId) return;

  const supabase = await createSupabaseServerClient();
  const [{ data: source }, { data: target }] = await Promise.all([
    supabase.from("item").select("name, aliases").eq("id", sourceItemId).maybeSingle(),
    supabase.from("item").select("aliases").eq("id", targetItemId).maybeSingle(),
  ]);
  if (!source || !target) return;

  const { error: detailError } = await supabase
    .from("transaction_detail")
    .update({ item_id: targetItemId })
    .eq("item_id", sourceItemId);
  if (detailError) return;

  const mergedAliases = mergeAliases(itemAliasesToArray(target.aliases), [
    source.name,
    ...itemAliasesToArray(source.aliases),
  ]);
  await supabase.from("item").update({ aliases: mergedAliases }).eq("id", targetItemId);

  await supabase.from("item").update({ merged_into_item_id: targetItemId }).eq("id", sourceItemId);

  revalidatePath(PATH);
}
