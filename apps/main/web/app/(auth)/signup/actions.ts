"use server";

import { createSupabaseServerClient } from "@account-books/supabase-client";
import { signUpSchema } from "@/lib/auth-schemas";
import { getOrigin } from "@/app/actions/auth";

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
  const origin = await getOrigin();
  // emailRedirectTo를 안 넘기면 Supabase가 Site URL(대시보드 설정, 보통 앱 루트)로 바로 리다이렉트
  // 시켜버려 /auth/callback의 코드 교환 로직을 안 거치게 된다 — Confirm email을 다시 켤 때를 대비해
  // 지금 미리 맞춰둔다(현재는 Confirm email이 꺼져있어 이 링크 자체가 발송되지 않지만).
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name },
      emailRedirectTo: `${origin}/auth/callback`,
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
