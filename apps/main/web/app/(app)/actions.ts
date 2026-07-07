"use server";

import { createSupabaseServerClient } from "@account-books/supabase-client";
import { periodToRange } from "@/lib/dashboard-queries";
import { resolveCanonicalItemId } from "@/lib/item-merge";

export interface ItemVendorBreakdownEntry {
  vendorName: string;
  total: number;
}

// F-3-1-3 드릴다운: Top10에서 품목 하나를 클릭하면 그 품목을 어느 지출처에서 얼마씩 샀는지 보여준다
// (아키텍처 설계서 5장 "item_id로 transaction_detail → transaction → vendor 역추적"). 클릭한
// 시점에만 조회하는 온디맨드 데이터라 캐시(S-3-6)는 적용하지 않음 — Top10 랭킹 자체와 달리 매번
// 다시 볼 확률이 낮고, 캐시 키 조합(itemId×period)이 많아져 무효화 관리 비용만 늘어난다.
//
// 병합(F-1-6-3) 처리: 클릭한 itemId로 병합돼 들어온(merged_into_item_id가 그 id를 가리키는)
// 다른 품목들의 transaction_detail도 함께 모아야 "대표 품목 기준 전체 내역"이 된다.
export async function getItemVendorBreakdown(
  itemId: string,
  period: string
): Promise<ItemVendorBreakdownEntry[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: items } = await supabase
    .from("item")
    .select("id, merged_into_item_id")
    .eq("user_id", user.id);
  const mergeableItems = items ?? [];

  const relevantItemIds = mergeableItems
    .filter((item) => resolveCanonicalItemId(item.id, mergeableItems) === itemId)
    .map((item) => item.id);
  if (!relevantItemIds.includes(itemId)) relevantItemIds.push(itemId);

  const { start, end } = periodToRange(period);

  const { data } = await supabase
    .from("transaction_detail")
    .select("amount, transaction:transaction_id!inner(occurred_at, vendor:vendor_id(name))")
    .in("item_id", relevantItemIds)
    .gte("transaction.occurred_at", start.toISOString())
    .lt("transaction.occurred_at", end.toISOString());

  const totalsByVendor = new Map<string, number>();
  for (const row of data ?? []) {
    const vendorName = row.transaction?.vendor?.name ?? "알 수 없음";
    totalsByVendor.set(vendorName, (totalsByVendor.get(vendorName) ?? 0) + row.amount);
  }

  return Array.from(totalsByVendor.entries())
    .map(([vendorName, total]) => ({ vendorName, total }))
    .sort((a, b) => b.total - a.total);
}
