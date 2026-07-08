"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { categorySchema } from "@/lib/category-schemas";

const PATH = "/settings/categories";

export type CategoryActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string }
  | { status: "validation_error"; errors: Partial<Record<string, string[]>> };

export async function addCategoryAction(
  _prev: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || undefined,
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

  const { error } = await supabase.from("category").insert({
    user_id: user.id,
    name: parsed.data.name,
    icon: parsed.data.icon ?? null,
  });

  if (error) return { status: "error", message: "지출항목 등록에 실패했습니다" };

  revalidatePath(PATH);
  return { status: "success" };
}

export async function updateCategoryAction(
  _prev: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { status: "error", message: "잘못된 요청입니다" };

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "validation_error",
      errors: parsed.error.flatten((i) => i.message).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("category")
    .update({
      name: parsed.data.name,
      icon: parsed.data.icon ?? null,
    })
    .eq("id", id)
    .eq("is_system_default", false);

  if (error) return { status: "error", message: "지출항목 수정에 실패했습니다" };

  revalidatePath(PATH);
  return { status: "success" };
}

// 삭제 정책 미생성(데이터정책_및_시드정의서 2장) — is_active 토글로 대체.
// 기본 지출항목도 이제 사용자별 소유 행이라(회원가입 트리거로 생성) 토글 허용 — is_system_default 제한 없음.
export async function setActiveAction(id: string, isActive: boolean) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("category").update({ is_active: isActive }).eq("id", id);
  revalidatePath(PATH);
}
