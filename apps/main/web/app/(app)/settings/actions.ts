"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@account-books/supabase-client";

// ── 프로필(이름) 수정 ──────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, "이름을 입력해 주세요").max(50, "이름이 너무 깁니다"),
});

export type ProfileState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string }
  | { status: "validation_error"; errors: Partial<Record<string, string[]>> };

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const parsed = profileSchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    return {
      status: "validation_error",
      errors: parsed.error.flatten((i) => i.message).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    data: { display_name: parsed.data.name },
  });

  if (error) {
    return { status: "error", message: "프로필 업데이트에 실패했습니다" };
  }

  return { status: "success" };
}

// ── 비밀번호 변경 ──────────────────────────────────────────────

const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다")
      .max(72, "비밀번호가 너무 깁니다"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });

export type PasswordState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string }
  | { status: "validation_error"; errors: Partial<Record<string, string[]>> };

export async function updatePasswordAction(
  _prev: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  const parsed = passwordSchema.safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "validation_error",
      errors: parsed.error.flatten((i) => i.message).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });

  if (error) {
    return { status: "error", message: "비밀번호 변경에 실패했습니다. 다시 시도해 주세요" };
  }

  return { status: "success" };
}
