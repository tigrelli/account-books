/**
 * T-1-6-1 병합 로직 단위 테스트 시나리오 데이터 (merged_into_item_id 그룹화 검증)
 * 단위 테스트: account-books/apps/main/web/__tests__/item-merge.test.ts
 * F-1-6-3(품목 수동 병합)의 mergeItemAction이 병합 시점에 transaction_detail.item_id를
 * 즉시 재배정하지만 완벽한 원자성은 아니라는 한계를 보완하는 lib/item-merge.ts 검증.
 */

/** @type {import("../sync-test-sheet.mjs").TaskTestData} */
export default {
  taskId: "T-1-6-1",
  title: "병합 로직 단위테스트 (merged_into_item_id 그룹화 검증)",
  unit: [
    {
      no: 1,
      category: "resolveCanonicalItemId",
      scenario: "병합된 적 없으면 자기 자신을 반환한다",
      input: "A(merged_into_item_id: null)",
      expected: "A",
    },
    {
      no: 2,
      category: "resolveCanonicalItemId",
      scenario: "1단계 병합(A→B)이면 B를 반환한다",
      input: "A→B, B→null",
      expected: "B",
    },
    {
      no: 3,
      category: "resolveCanonicalItemId",
      scenario: "다단계 병합(A→B→C)이면 최종 대상 C를 반환한다",
      input: "A→B→C→null",
      expected: "C",
    },
    {
      no: 4,
      category: "resolveCanonicalItemId",
      scenario: "순환 참조(A→B→A)가 있어도 무한루프 없이 종료한다",
      input: "A→B, B→A",
      expected: "예외 없이 종료",
    },
    {
      no: 5,
      category: "resolveCanonicalItemId",
      scenario: "목록에 없는 item_id를 넘기면 자기 자신을 반환한다",
      input: "itemId: X, items: []",
      expected: "X",
    },
    {
      no: 6,
      category: "groupByCanonicalItem",
      scenario: "병합 없는 품목은 각자 그대로 합산된다",
      input: "A:1000+500, B:2000",
      expected: "A=1500, B=2000",
    },
    {
      no: 7,
      category: "groupByCanonicalItem",
      scenario: "병합된 품목(A→B)의 지출은 대표 품목(B) 합계로 묶인다",
      input: "A→B, A:1000, B:2000",
      expected: "B=3000, A 없음",
    },
    {
      no: 8,
      category: "groupByCanonicalItem",
      scenario: "다단계 병합(A→B→C)도 최종 대표 품목(C)으로 묶인다",
      input: "A→B→C, A:1000, B:500, C:2000",
      expected: "C=3500 (합계 1건)",
    },
    {
      no: 9,
      category: "groupByCanonicalItem",
      scenario: "상세항목이 없으면 빈 맵을 반환한다",
      input: "details: []",
      expected: "size 0",
    },
  ],
  e2e: [],
};
