import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
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
 *
 * `createServerClient`(@supabase/ssr)가 아니라 순수 `createClient`(@supabase/supabase-js)를
 * 쓴다 — @supabase/ssr은 쿠키에서 로그인 세션을 읽어 요청마다 "그 세션의" access_token을
 * Authorization으로 실어 보내는 게 원래 목적이라, 여기 Service Role Key를 넘겨도 로그인된
 * 사용자가 호출하면 여전히 그 사용자 권한(RLS 적용)으로 요청이 나간다 — Service Role Key가
 * 무시되는 셈. 세션/쿠키를 아예 안 쓰는 클라이언트여야 Service Role Key가 실제로
 * Authorization Bearer로 사용되어 RLS를 우회한다(F-3-1-5 동의어 추가가 "이미 등록된
 * 단어"로 잘못 실패하던 버그의 원인 — 실제로는 RLS가 authenticated에는 쓰기 정책이 없어서
 * 막힌 것이었다).
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
