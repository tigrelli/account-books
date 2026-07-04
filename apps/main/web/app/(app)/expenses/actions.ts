"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import type { Json } from "@account-books/types";
import { expenseSchema, expenseDetailSchema } from "@/lib/expense-schemas";
import { parseQuantityText } from "@/lib/quantity-parse";
import { itemAliasesToArray } from "@/lib/item-aliases";
import { resolveCanonicalItemId } from "@/lib/item-merge";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const PATH = "/expenses/create";
// 목록 화면(F-1-5-12)도 함께 무효화 — 사이드바의 <Link href="/expenses">가 자동 프리페치해두는
// Router Cache가 저장 후에도 남아있어 방금 저장한 지출이 목록에 안 보이는 문제 방지.
const LIST_PATH = "/expenses";
// 캘린더 화면(F-1-10-1)도 force-dynamic이지만, 빠른 입력 팝업(F-1-10-2)은 페이지 이동 없이
// 같은 라우트에 머무르므로 Router Cache 무효화를 위해 명시적으로 함께 재검증.
const CALENDAR_PATH = "/expenses/calendar";

export type ExpenseActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string }
  | { status: "validation_error"; errors: Partial<Record<string, string[]>> };

// 지출처는 사전 등록이 필수가 아님 — 정확히 일치하는 이름이 있으면 재사용, 없으면 그 자리에서 새로 등록.
// 2026-07-03 PM 결정: 지출처는 여러 카테고리의 지출이 섞일 수 있어(예: GS슈퍼에서 식료품+의류) 특정
// 카테고리에 고정 매칭하지 않음 — default_category_id는 항상 null(컬럼 자체는 유지, 지출처 관리 화면 참고).
async function resolveVendorId(
  supabase: SupabaseServerClient,
  userId: string,
  vendorName: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("vendor")
    .select("id")
    .eq("user_id", userId)
    .eq("name", vendorName)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("vendor")
    .insert({ user_id: userId, name: vendorName })
    .select("id")
    .single();

  return created?.id ?? null;
}

type ResolvableItem = {
  id: string;
  name: string;
  aliases: Json;
  merged_into_item_id: string | null;
};

// 이름/별칭 일치(대소문자 무시)로 기존 Item 재사용 — 자동완성에서 제안을 직접 클릭하지 않고
// 그냥 타이핑만 해도, 이미 병합된 품목(예: "깐 양파"→"양파")은 항상 최종 대표 품목으로 귀결되어야
// 통계가 갈라지지 않는다(2026-07-04 PM 확인 — 병합 의도 자체가 "앞으로도 하나로 보고 싶다"임).
// ① itemId가 이미 주어졌어도(자동완성에서 선택) 혹시 그 품목이 그 사이 다른 곳으로 병합됐을 가능성을
//    대비해 항상 resolveCanonicalItemId로 한 번 더 체인을 확인 ② 이름/별칭으로 새로 찾은 경우도 동일하게
//    체인 끝까지 resolve ③ 아무것도 못 찾으면 새 품목 생성. 같은 제출 안에서 같은 신규 이름이 여러 행에
//    나오면(예: "양파" 두 줄) 중복 생성되지 않도록 요청 스코프 캐시(cache)를 먼저 확인.
async function resolveItemId(
  supabase: SupabaseServerClient,
  userId: string,
  itemText: string,
  itemId: string | undefined,
  categoryId: string,
  cache: Map<string, string>,
  userItems: ResolvableItem[]
): Promise<string | null> {
  if (itemId) return resolveCanonicalItemId(itemId, userItems);

  const cacheKey = itemText.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const matched = userItems.find(
    (item) =>
      item.name.toLowerCase() === cacheKey ||
      itemAliasesToArray(item.aliases).some((alias) => alias.toLowerCase() === cacheKey)
  );

  if (matched) {
    const canonicalId = resolveCanonicalItemId(matched.id, userItems);
    cache.set(cacheKey, canonicalId);
    return canonicalId;
  }

  const { data: created } = await supabase
    .from("item")
    .insert({ user_id: userId, name: itemText, default_category_id: categoryId })
    .select("id")
    .single();

  if (created) cache.set(cacheKey, created.id);
  return created?.id ?? null;
}

// 이름 대소문자 무시 일치로 기존 Unit(시스템 기본+내 커스텀) 재사용, 없으면 사용자 커스텀 단위로 생성.
// UI(ExpenseEntryForm의 신규 단위 안내)와 동일한 매칭 기준 — 대소문자만 다르면 같은 단위로 취급.
async function resolveUnitId(
  supabase: SupabaseServerClient,
  userId: string,
  unitText: string,
  cache: Map<string, string>
): Promise<string | null> {
  const cacheKey = unitText.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data: existing } = await supabase
    .from("unit")
    .select("id")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .ilike("name", unitText)
    .maybeSingle();

  if (existing) {
    cache.set(cacheKey, existing.id);
    return existing.id;
  }

  const { data: created } = await supabase
    .from("unit")
    .insert({ user_id: userId, name: unitText, is_system_default: false })
    .select("id")
    .single();

  if (created) cache.set(cacheKey, created.id);
  return created?.id ?? null;
}

export async function addExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const hasDetail = formData.get("hasDetail") === "true";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "로그인이 필요합니다" };

  if (hasDetail) {
    const itemTexts = formData.getAll("detailItemText");
    const itemIds = formData.getAll("detailItemId");
    const quantityTexts = formData.getAll("detailQuantityText");
    const amounts = formData.getAll("detailAmount");

    const details = itemTexts.map((itemText, i) => ({
      itemText,
      itemId: itemIds[i] || undefined,
      quantityText: quantityTexts[i],
      amount: amounts[i],
    }));

    const parsed = expenseDetailSchema.safeParse({
      occurredAt: formData.get("occurredAt"),
      paymentMethodId: formData.get("paymentMethodId"),
      categoryId: formData.get("categoryId"),
      vendorName: formData.get("vendorName"),
      details,
    });

    if (!parsed.success) {
      return {
        status: "error",
        message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요",
      };
    }

    const {
      occurredAt,
      paymentMethodId,
      categoryId,
      vendorName,
      details: parsedDetails,
    } = parsed.data;

    const vendorId = await resolveVendorId(supabase, user.id, vendorName);
    if (!vendorId) return { status: "error", message: "지출처 등록에 실패했습니다" };

    const itemCache = new Map<string, string>();
    const unitCache = new Map<string, string>();
    const { data: userItems } = await supabase
      .from("item")
      .select("id, name, aliases, merged_into_item_id")
      .eq("user_id", user.id);

    const detailRows: {
      transaction_id: string;
      item_id: string;
      item_raw_text: string;
      quantity_value: number | null;
      unit_id: string | null;
      quantity_raw_text: string | null;
      amount: number;
    }[] = [];

    // 임시 transaction_id는 아래 transaction insert 이후 채움 — 먼저 item/unit 해석부터 순차 처리
    // (같은 이름이 여러 행에 나오면 캐시로 재사용, 동시 조회로 인한 중복 생성 방지).
    for (const detail of parsedDetails) {
      const itemId = await resolveItemId(
        supabase,
        user.id,
        detail.itemText,
        detail.itemId,
        categoryId,
        itemCache,
        userItems ?? []
      );
      if (!itemId) return { status: "error", message: "상세항목(품목) 등록에 실패했습니다" };

      const parsedQuantity = parseQuantityText(detail.quantityText ?? "");
      let unitId: string | null = null;
      if (parsedQuantity?.unitText) {
        unitId = await resolveUnitId(supabase, user.id, parsedQuantity.unitText, unitCache);
        if (!unitId) return { status: "error", message: "단위 등록에 실패했습니다" };
      }

      detailRows.push({
        transaction_id: "",
        item_id: itemId,
        item_raw_text: detail.itemText,
        quantity_value: parsedQuantity ? parsedQuantity.value : null,
        unit_id: unitId,
        quantity_raw_text: parsedQuantity ? null : detail.quantityText?.trim() || null,
        amount: detail.amount,
      });
    }

    const totalAmount = detailRows.reduce((sum, d) => sum + d.amount, 0);

    const { data: transaction, error: transactionError } = await supabase
      .from("transaction")
      .insert({
        user_id: user.id,
        payment_method_id: paymentMethodId,
        category_id: categoryId,
        vendor_id: vendorId,
        input_type: "MANUAL",
        amount: totalAmount,
        has_detail: true,
        occurred_at: new Date(occurredAt).toISOString(),
      })
      .select("id")
      .single();

    if (transactionError || !transaction)
      return { status: "error", message: "지출 저장에 실패했습니다" };

    const { error: detailError } = await supabase
      .from("transaction_detail")
      .insert(detailRows.map((d) => ({ ...d, transaction_id: transaction.id })));

    if (detailError) {
      // 상세항목 저장 실패 시 방금 만든 transaction만 남는 상태(has_detail=true인데 상세행 없음)를 방지하기 위한 보상 삭제.
      await supabase.from("transaction").delete().eq("id", transaction.id);
      return { status: "error", message: "상세항목 저장에 실패했습니다" };
    }

    revalidatePath(PATH);
    revalidatePath(LIST_PATH);
    revalidatePath(CALENDAR_PATH);
    return { status: "success" };
  }

  const parsed = expenseSchema.safeParse({
    occurredAt: formData.get("occurredAt"),
    paymentMethodId: formData.get("paymentMethodId"),
    categoryId: formData.get("categoryId"),
    vendorName: formData.get("vendorName"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return {
      status: "validation_error",
      errors: parsed.error.flatten((i) => i.message).fieldErrors,
    };
  }

  const { occurredAt, paymentMethodId, categoryId, vendorName, amount } = parsed.data;

  const vendorId = await resolveVendorId(supabase, user.id, vendorName);
  if (!vendorId) return { status: "error", message: "지출처 등록에 실패했습니다" };

  const { error: transactionError } = await supabase.from("transaction").insert({
    user_id: user.id,
    payment_method_id: paymentMethodId,
    category_id: categoryId,
    vendor_id: vendorId,
    input_type: "MANUAL",
    amount,
    occurred_at: new Date(occurredAt).toISOString(),
  });

  if (transactionError) return { status: "error", message: "지출 저장에 실패했습니다" };

  revalidatePath(PATH);
  revalidatePath(LIST_PATH);
  revalidatePath(CALENDAR_PATH);
  return { status: "success" };
}

// id는 CategoryRow/VendorRow 등 기존 마스터데이터 수정 폼과 동일하게 hidden input(formData)으로 전달.
// RLS가 본인 소유 행만 select/update 가능하게 강제하므로, 조회 결과가 없으면 "존재하지 않거나 남의 것" 둘 다 같은 메시지로 처리.
export async function updateExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { status: "error", message: "잘못된 요청입니다" };

  const hasDetail = formData.get("hasDetail") === "true";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "로그인이 필요합니다" };

  const { data: existing } = await supabase
    .from("transaction")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { status: "error", message: "지출 내역을 찾을 수 없습니다" };

  if (hasDetail) {
    const itemTexts = formData.getAll("detailItemText");
    const itemIds = formData.getAll("detailItemId");
    const quantityTexts = formData.getAll("detailQuantityText");
    const amounts = formData.getAll("detailAmount");

    const details = itemTexts.map((itemText, i) => ({
      itemText,
      itemId: itemIds[i] || undefined,
      quantityText: quantityTexts[i],
      amount: amounts[i],
    }));

    const parsed = expenseDetailSchema.safeParse({
      occurredAt: formData.get("occurredAt"),
      paymentMethodId: formData.get("paymentMethodId"),
      categoryId: formData.get("categoryId"),
      vendorName: formData.get("vendorName"),
      details,
    });

    if (!parsed.success) {
      return {
        status: "error",
        message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요",
      };
    }

    const {
      occurredAt,
      paymentMethodId,
      categoryId,
      vendorName,
      details: parsedDetails,
    } = parsed.data;

    const vendorId = await resolveVendorId(supabase, user.id, vendorName);
    if (!vendorId) return { status: "error", message: "지출처 등록에 실패했습니다" };

    const itemCache = new Map<string, string>();
    const unitCache = new Map<string, string>();
    const { data: userItems } = await supabase
      .from("item")
      .select("id, name, aliases, merged_into_item_id")
      .eq("user_id", user.id);

    const detailRows: {
      transaction_id: string;
      item_id: string;
      item_raw_text: string;
      quantity_value: number | null;
      unit_id: string | null;
      quantity_raw_text: string | null;
      amount: number;
    }[] = [];

    for (const detail of parsedDetails) {
      const itemId = await resolveItemId(
        supabase,
        user.id,
        detail.itemText,
        detail.itemId,
        categoryId,
        itemCache,
        userItems ?? []
      );
      if (!itemId) return { status: "error", message: "상세항목(품목) 등록에 실패했습니다" };

      const parsedQuantity = parseQuantityText(detail.quantityText ?? "");
      let unitId: string | null = null;
      if (parsedQuantity?.unitText) {
        unitId = await resolveUnitId(supabase, user.id, parsedQuantity.unitText, unitCache);
        if (!unitId) return { status: "error", message: "단위 등록에 실패했습니다" };
      }

      detailRows.push({
        transaction_id: id,
        item_id: itemId,
        item_raw_text: detail.itemText,
        quantity_value: parsedQuantity ? parsedQuantity.value : null,
        unit_id: unitId,
        quantity_raw_text: parsedQuantity ? null : detail.quantityText?.trim() || null,
        amount: detail.amount,
      });
    }

    const totalAmount = detailRows.reduce((sum, d) => sum + d.amount, 0);

    const { error: transactionError } = await supabase
      .from("transaction")
      .update({
        payment_method_id: paymentMethodId,
        category_id: categoryId,
        vendor_id: vendorId,
        amount: totalAmount,
        has_detail: true,
        occurred_at: new Date(occurredAt).toISOString(),
      })
      .eq("id", id);

    if (transactionError) return { status: "error", message: "지출 수정에 실패했습니다" };

    // 기존 상세항목은 통째로 지우고 새로 넣는 방식(부분 diff 없음) — 행 개수가 적어 실용적으로 충분.
    await supabase.from("transaction_detail").delete().eq("transaction_id", id);

    const { error: detailError } = await supabase.from("transaction_detail").insert(detailRows);
    if (detailError) return { status: "error", message: "상세항목 저장에 실패했습니다" };
  } else {
    const parsed = expenseSchema.safeParse({
      occurredAt: formData.get("occurredAt"),
      paymentMethodId: formData.get("paymentMethodId"),
      categoryId: formData.get("categoryId"),
      vendorName: formData.get("vendorName"),
      amount: formData.get("amount"),
    });

    if (!parsed.success) {
      return {
        status: "validation_error",
        errors: parsed.error.flatten((i) => i.message).fieldErrors,
      };
    }

    const { occurredAt, paymentMethodId, categoryId, vendorName, amount } = parsed.data;

    const vendorId = await resolveVendorId(supabase, user.id, vendorName);
    if (!vendorId) return { status: "error", message: "지출처 등록에 실패했습니다" };

    const { error: transactionError } = await supabase
      .from("transaction")
      .update({
        payment_method_id: paymentMethodId,
        category_id: categoryId,
        vendor_id: vendorId,
        amount,
        has_detail: false,
        occurred_at: new Date(occurredAt).toISOString(),
      })
      .eq("id", id);

    if (transactionError) return { status: "error", message: "지출 수정에 실패했습니다" };

    // 상세모드 → 직접입력 모드로 전환한 경우 남아있던 상세행 정리.
    await supabase.from("transaction_detail").delete().eq("transaction_id", id);
  }

  revalidatePath(LIST_PATH);
  revalidatePath(CALENDAR_PATH);
  // F-1-10-2: 캘린더의 수정 팝업은 페이지 이동 없이 그 자리에서 닫혀야 하므로, addExpenseAction과
  // 동일하게 여기서 강제 redirect하지 않고 성공 상태만 반환 — 화면 이동이 필요한 호출부
  // (기존 /expenses/[id]/edit 페이지)는 ExpenseEntryForm의 onSuccess에서 직접 라우팅한다.
  return { status: "success" };
}

// CategorySection의 setActiveAction과 동일하게 useActionState 없이 직접 호출하는 단순 서버 액션.
// 삭제 확인(confirm)은 호출부(클라이언트)에서 처리 — TRANSACTION은 soft delete 정책이 없어 실제 행 삭제(데이터정책 2장),
// transaction_detail은 FK ON DELETE CASCADE로 함께 삭제됨.
export async function deleteExpenseAction(id: string) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("transaction").delete().eq("id", id);
  revalidatePath(LIST_PATH);
  revalidatePath(CALENDAR_PATH);
}
