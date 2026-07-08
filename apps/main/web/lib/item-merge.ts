import type { Database } from "@account-books/types";

type Item = Database["public"]["Tables"]["item"]["Row"];
type MergeableItem = Pick<Item, "id" | "merged_into_item_id">;

// 병합 체인(A→B→C 등)을 따라가 최종 대표 품목 id를 찾는다. 순환 참조가 섞여 있어도
// (데이터 오류로 A→B→A가 생기는 경우) 무한루프에 빠지지 않도록 방문 이력으로 방어.
export function resolveCanonicalItemId(itemId: string, items: MergeableItem[]): string {
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const visited = new Set<string>();
  let current = itemId;

  while (!visited.has(current)) {
    visited.add(current);
    const next = itemsById.get(current)?.merged_into_item_id;
    if (!next) return current;
    current = next;
  }

  return current;
}

// 상세항목(품목별 지출) 목록을 병합 체인을 따라 대표 품목 기준으로 그룹화해 합계를 낸다.
// mergeItemAction(F-1-6-3)이 병합 시점에 transaction_detail.item_id를 즉시 재배정하지만,
// 멀티 스테이트먼트 트랜잭션 미지원으로 완벽한 원자성은 아니라는 알려진 한계가 있음 — 통계/Top10
// 집계(F-3-1-3 등) 쪽에서 재배정이 누락된 과거 데이터가 섞여 있어도 항상 대표 품목으로 정확히
// 묶이도록 하는 방어 로직.
export function groupByCanonicalItem(
  details: { itemId: string; amount: number }[],
  items: MergeableItem[]
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const detail of details) {
    const canonicalId = resolveCanonicalItemId(detail.itemId, items);
    totals.set(canonicalId, (totals.get(canonicalId) ?? 0) + detail.amount);
  }

  return totals;
}
