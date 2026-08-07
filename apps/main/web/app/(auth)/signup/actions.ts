"use server";

import { createSupabaseAdminClient } from "@account-books/supabase-client";
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

  // 이메일 발신 기능(SMTP)이 아직 없어 확인 메일 링크로 가입을 완료시키는 흐름을 쓸 수 없다
  // (2026-07-08 진행현황.md 기록 — 프로덕션 SMTP 미비로 구글 로그인을 우회 대안으로 추가했던 것과
  // 같은 제약). 일반 signUp()은 프로젝트의 Confirm email 설정이 켜져 있으면 중복 이메일에도
  // 에러 없이 가짜 유저를 반환해(이메일 열거 공격 방지용 Supabase 기본 동작) 중복 가입을 걸러낼
  // 수 없다. 대신 Service Role 기반 admin.createUser()로 즉시 확인 완료 상태의 계정을 만들고,
  // 중복 이메일은 admin API가 항상 명시적인 에러(email_exists)로 알려준다.
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });

  if (error) {
    if (error.code === "email_exists" || error.message.includes("already been registered")) {
      return { status: "error", message: "이미 사용 중인 이메일입니다" };
    }
    return {
      status: "error",
      message: "회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요",
    };
  }

  return { status: "success", email };
}
