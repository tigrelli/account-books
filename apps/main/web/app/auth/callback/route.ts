import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@account-books/supabase-client";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 코드가 없거나 교환 실패 시 로그인으로 이동
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
