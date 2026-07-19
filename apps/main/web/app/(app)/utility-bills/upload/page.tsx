import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { UtilityBillUploadSection } from "./UtilityBillUploadSection";

// 지출 목록/예산 화면과 동일 원칙 — 업로드 직후 같은 경로를 다시 볼 수 있어 캐시하지 않는다.
export const dynamic = "force-dynamic";

function recentPeriods(count: number): string[] {
  const now = new Date();
  const periods: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return periods;
}

export default async function UtilityBillUploadPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const periods = recentPeriods(3);

  const { data: records } = await supabase
    .from("utility_bill_record")
    .select("period")
    .in("period", periods);

  const registeredPeriods = new Set((records ?? []).map((r) => r.period));
  const recentStatus = periods.map((period) => ({
    period,
    registered: registeredPeriods.has(period),
  }));

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">명세서 업로드</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              관리비 고지서 사진을 올리면 항목별로 자동 등록됩니다
            </p>
          </div>
          <Link
            href="/utility-bills/stats"
            prefetch={false}
            className="shrink-0 text-sm font-medium text-[var(--paylens-action)] hover:underline"
          >
            통계 보기
          </Link>
        </div>

        <UtilityBillUploadSection recentStatus={recentStatus} />
      </div>
    </div>
  );
}
