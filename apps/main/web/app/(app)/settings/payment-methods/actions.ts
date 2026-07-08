"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { cardSchema, displayNameSchema } from "@/lib/payment-method-schemas";

const PATH = "/settings/payment-methods";

export type PaymentMethodActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string }
  | { status: "validation_error"; errors: Partial<Record<string, string[]>> };

export async function addCardAction(
  _prev: PaymentMethodActionState,
  formData: FormData
): Promise<PaymentMethodActionState> {
  const parsed = cardSchema.safeParse({
    displayName: formData.get("displayName"),
    cardKind: formData.get("cardKind"),
  });

  if (!parsed.success) {
    return {
      status: "validation_error",
      errors: parsed.error.flatten((i) => i.message).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "로그인이 필요합니다" };

  const { error } = await supabase.from("payment_method").insert({
    user_id: user.id,
    type: "CARD",
    display_name: parsed.data.displayName,
    card_issuer: null,
    card_kind: parsed.data.cardKind,
  });

  if (error) return { status: "error", message: "카드 등록에 실패했습니다" };

  revalidatePath(PATH);
  return { status: "success" };
}

export async function updateCardAction(
  _prev: PaymentMethodActionState,
  formData: FormData
): Promise<PaymentMethodActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { status: "error", message: "잘못된 요청입니다" };

  const parsed = cardSchema.safeParse({
    displayName: formData.get("displayName"),
    cardKind: formData.get("cardKind"),
  });

  if (!parsed.success) {
    return {
      status: "validation_error",
      errors: parsed.error.flatten((i) => i.message).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("payment_method")
    .update({
      display_name: parsed.data.displayName,
      card_issuer: null,
      card_kind: parsed.data.cardKind,
    })
    .eq("id", id);

  if (error) return { status: "error", message: "카드 정보 수정에 실패했습니다" };

  revalidatePath(PATH);
  return { status: "success" };
}

export async function addAccountAction(
  _prev: PaymentMethodActionState,
  formData: FormData
): Promise<PaymentMethodActionState> {
  const parsed = displayNameSchema.safeParse({ displayName: formData.get("displayName") });

  if (!parsed.success) {
    return {
      status: "validation_error",
      errors: parsed.error.flatten((i) => i.message).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "로그인이 필요합니다" };

  const { error } = await supabase.from("payment_method").insert({
    user_id: user.id,
    type: "CASH",
    subtype: "AUTO_TRANSFER",
    display_name: parsed.data.displayName,
  });

  if (error) return { status: "error", message: "계좌 등록에 실패했습니다" };

  revalidatePath(PATH);
  return { status: "success" };
}

export async function updateDisplayNameAction(
  _prev: PaymentMethodActionState,
  formData: FormData
): Promise<PaymentMethodActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { status: "error", message: "잘못된 요청입니다" };

  const parsed = displayNameSchema.safeParse({ displayName: formData.get("displayName") });

  if (!parsed.success) {
    return {
      status: "validation_error",
      errors: parsed.error.flatten((i) => i.message).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("payment_method")
    .update({ display_name: parsed.data.displayName })
    .eq("id", id);

  if (error) return { status: "error", message: "이름 변경에 실패했습니다" };

  revalidatePath(PATH);
  return { status: "success" };
}

// 삭제 정책 미생성(데이터정책_및_시드정의서 3장) — is_active 토글로 대체
export async function setActiveAction(id: string, isActive: boolean) {
  const supabase = await createSupabaseServerClient();
  // 지갑(현금)은 비활성화 불가(데이터정책_및_시드정의서 1-2) — 방어적으로 시스템 기본값 제외
  await supabase
    .from("payment_method")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("is_system_default", false);
  revalidatePath(PATH);
}
