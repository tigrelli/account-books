import { describe, it, expect } from "vitest";
import { resolveCanonicalItemId, groupByCanonicalItem } from "../lib/item-merge";

describe("resolveCanonicalItemId", () => {
  it("병합된 적 없으면 자기 자신을 반환한다", () => {
    const items = [{ id: "A", merged_into_item_id: null }];
    expect(resolveCanonicalItemId("A", items)).toBe("A");
  });

  it("1단계 병합(A→B)이면 B를 반환한다", () => {
    const items = [
      { id: "A", merged_into_item_id: "B" },
      { id: "B", merged_into_item_id: null },
    ];
    expect(resolveCanonicalItemId("A", items)).toBe("B");
  });

  it("다단계 병합(A→B→C)이면 최종 대상 C를 반환한다", () => {
    const items = [
      { id: "A", merged_into_item_id: "B" },
      { id: "B", merged_into_item_id: "C" },
      { id: "C", merged_into_item_id: null },
    ];
    expect(resolveCanonicalItemId("A", items)).toBe("C");
  });

  it("순환 참조(A→B→A)가 있어도 무한루프 없이 종료한다", () => {
    const items = [
      { id: "A", merged_into_item_id: "B" },
      { id: "B", merged_into_item_id: "A" },
    ];
    expect(() => resolveCanonicalItemId("A", items)).not.toThrow();
  });

  it("목록에 없는 item_id를 넘기면 자기 자신을 반환한다", () => {
    expect(resolveCanonicalItemId("X", [])).toBe("X");
  });
});

describe("groupByCanonicalItem", () => {
  it("병합 없는 품목은 각자 그대로 합산된다", () => {
    const items = [
      { id: "A", merged_into_item_id: null },
      { id: "B", merged_into_item_id: null },
    ];
    const details = [
      { itemId: "A", amount: 1000 },
      { itemId: "B", amount: 2000 },
      { itemId: "A", amount: 500 },
    ];
    const totals = groupByCanonicalItem(details, items);
    expect(totals.get("A")).toBe(1500);
    expect(totals.get("B")).toBe(2000);
  });

  it("병합된 품목(A→B)의 지출은 대표 품목(B) 합계로 묶인다", () => {
    const items = [
      { id: "A", merged_into_item_id: "B" },
      { id: "B", merged_into_item_id: null },
    ];
    const details = [
      { itemId: "A", amount: 1000 },
      { itemId: "B", amount: 2000 },
    ];
    const totals = groupByCanonicalItem(details, items);
    expect(totals.get("B")).toBe(3000);
    expect(totals.has("A")).toBe(false);
  });

  it("다단계 병합(A→B→C)도 최종 대표 품목(C)으로 묶인다", () => {
    const items = [
      { id: "A", merged_into_item_id: "B" },
      { id: "B", merged_into_item_id: "C" },
      { id: "C", merged_into_item_id: null },
    ];
    const details = [
      { itemId: "A", amount: 1000 },
      { itemId: "B", amount: 500 },
      { itemId: "C", amount: 2000 },
    ];
    const totals = groupByCanonicalItem(details, items);
    expect(totals.get("C")).toBe(3500);
    expect(totals.size).toBe(1);
  });

  it("상세항목이 없으면 빈 맵을 반환한다", () => {
    expect(groupByCanonicalItem([], []).size).toBe(0);
  });
});
