"use server";

import { createSupabaseServerClient } from "@account-books/supabase-client";
import { signUpSchema } from "@/lib/auth-schemas";

export type SignUpState =
  | { status: "idle" }
  | { status: "success"; email: string }
  | { status: "error"; message: string }
  | { status: "validation_error"; errors: Partial<Record<string, string[]>> };

export async function signUpAction(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = signUpSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "validation_error",
      errors: parsed.error.flatten((i) => i.message).fieldErrors,
    };
  }

  const { name, email, password } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name },
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return { status: "error", message: "이미 사용 중인 이메일입니다" };
    }
    return {
      status: "error",
      message: "회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요",
    };
  }

  return { status: "success", email };
}
