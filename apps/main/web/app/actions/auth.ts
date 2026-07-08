"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@account-books/supabase-client";

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Vercel Preview 배포마다 URL이 달라지고 SITE_URL 같은 고정 env var로는 대응이 안 되므로,
// 요청 헤더에서 실제 접속 origin을 읽는다(Server Action도 그 액션을 호출한 요청의 헤더를 그대로 읽을 수 있음).
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// S-1-13: 구글 로그인(OAuth) — 로그인/회원가입 공용. 성공/실패 모두 페이지 이동으로 끝나 별도
// 상태(useActionState) 없이 <form action={signInWithGoogleAction}>에 바로 물릴 수 있다.
export async function signInWithGoogleAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth_failed");
  }

  redirect(data.url);
}
