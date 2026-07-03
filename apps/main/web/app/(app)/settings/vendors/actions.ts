"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { vendorSchema } from "@/lib/vendor-schemas";

const PATH = "/settings/vendors";

export type VendorActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string }
  | { status: "validation_error"; errors: Partial<Record<string, string[]>> };

export async function addVendorAction(
  _prev: VendorActionState,
  formData: FormData
): Promise<VendorActionState> {
  const parsed = vendorSchema.safeParse({
    name: formData.get("name"),
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

  const { error } = await supabase.from("vendor").insert({
    user_id: user.id,
    name: parsed.data.name,
  });

  if (error) return { status: "error", message: "지출처 등록에 실패했습니다" };

  revalidatePath(PATH);
  return { status: "success" };
}

export async function updateVendorAction(
  _prev: VendorActionState,
  formData: FormData
): Promise<VendorActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { status: "error", message: "잘못된 요청입니다" };

  const parsed = vendorSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return {
      status: "validation_error",
      errors: parsed.error.flatten((i) => i.message).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("vendor")
    .update({
      name: parsed.data.name,
    })
    .eq("id", id);

  if (error) return { status: "error", message: "지출처 수정에 실패했습니다" };

  revalidatePath(PATH);
  return { status: "success" };
}

// 삭제 정책 미생성(데이터정책_및_시드정의서 2장) — is_active 토글로 대체
export async function setActiveAction(id: string, isActive: boolean) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("vendor").update({ is_active: isActive }).eq("id", id);
  revalidatePath(PATH);
}
