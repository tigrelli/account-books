import type { Json } from "@account-books/types";

// aliases는 jsonb라 타입상 Json — 실제 사용 전 문자열 배열로만 좁혀서 다룸.
export function itemAliasesToArray(aliases: Json): string[] {
  return Array.isArray(aliases) ? aliases.filter((a): a is string => typeof a === "string") : [];
}

// 기존 별칭 목록에 새 후보들을 대소문자 무시 중복 제거하며 합침 — 품목 병합(F-1-6-3) 시
// 병합되는 품목의 이름/별칭을 대상 품목의 별칭으로 흡수할 때 사용.
export function mergeAliases(base: string[], incoming: string[]): string[] {
  const merged = [...base];
  for (const candidate of incoming) {
    const isDuplicate = merged.some((a) => a.toLowerCase() === candidate.toLowerCase());
    if (!isDuplicate) merged.push(candidate);
  }
  return merged;
}
