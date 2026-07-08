"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { loginSchema } from "@/lib/auth-schemas";

export type LoginState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "validation_error"; errors: Partial<Record<string, string[]>> };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "validation_error",
      errors: parsed.error.flatten((i) => i.message).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      status: "error",
      message: "이메일 또는 비밀번호가 올바르지 않습니다",
    };
  }

  redirect("/");
}
