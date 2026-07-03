import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@account-books/types";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Server Component / Server Action / Route Handler에서 사용하는 Supabase 클라이언트.
 * Next.js App Router의 `cookies()`를 사용하므로 서버 전용.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        // Next.js가 global fetch를 패치해 GET 요청을 캐시할 수 있어, 다른 라우트에서의
        // mutation 이후에도 이 값이 그대로 재사용되는 문제 방지(F-1-5-12 검증 중 발견).
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            // SerializeOptions(@supabase/ssr)와 ResponseCookie(Next.js)의 타입 불일치를
            // 객체 스프레드로 우회 — 런타임 동작은 동일
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          } catch {
            // Server Component에서 호출된 경우 쿠키 쓰기 무시 (읽기 전용)
          }
        },
      },
    },
  );
}

/**
 * Service Role Key를 사용하는 서버 전용 관리자 클라이언트.
 * RLS를 우회하므로 Edge Function / Server Action에서만 사용할 것.
 * 절대 클라이언트 코드에 노출 금지.
 */
export async function createSupabaseAdminClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          } catch {
            // no-op
          }
        },
      },
    },
  );
}
