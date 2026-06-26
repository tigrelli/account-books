import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@account-books/types";

/**
 * 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase 클라이언트.
 * 싱글턴으로 사용하려면 호출부에서 useMemo 또는 모듈 레벨 변수로 캐싱할 것.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
