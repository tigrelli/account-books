import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "@account-books/types";

/**
 * Next.js middleware에서 세션을 갱신할 때 사용하는 클라이언트.
 * request/response 쿠키를 직접 조작하므로 middleware 전용.
 */
export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );
}
