// [S-2-9] 형식변경 판별 — 축소판(2026-07-13 PM 결정).
// 원 설계(관리비명세서_화면설계.md §1-2)의 매칭률 계산 부분만 순수 함수로 구현한다.
// 업로드 처리 분기(케이스 A/B, 항목 선정 화면 재진입 등 실제 화면 연동)는 F-2-1-2에서
// 진행 — 여기서는 "추출된 라벨이 기존 지정 항목과 얼마나 일치하는지" 계산만 한다.

export const FORMAT_MATCH_THRESHOLD = 0.5;

// OCR이 "일반관리비"를 "일반"+"관리비" 두 단어로 인식해 합칠 때 공백이 들어가는 등
// (S-2-8 실사진 검증에서 발견), 공백 차이만으로 불일치 판정되지 않도록 정규화한다.
// F-2-2-1(항목 선정 화면)의 "이번 달에 없음" 판정도 동일 기준을 써야 해서 export.
export function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, "");
}

/**
 * 추출된 라벨 목록과 사용자의 기존 지정 항목(활성 항목의 source_labels)을 비교해
 * 매칭률(0~1)을 계산한다. 분모는 "기존 지정 항목 개수" — 지정 항목이 하나도 없으면
 * (최초 업로드) 0을 반환한다.
 */
export function calculateFormatMatchRate(
  extractedLabels: string[],
  registeredSourceLabels: string[][]
): number {
  if (registeredSourceLabels.length === 0) return 0;

  const normalizedExtracted = extractedLabels.map(normalizeLabel);
  const matchedCount = registeredSourceLabels.filter((aliases) =>
    aliases.some((alias) => normalizedExtracted.includes(normalizeLabel(alias)))
  ).length;

  return matchedCount / registeredSourceLabels.length;
}

/** 매칭률 ≥ 50%면 동일 양식(재업로드), 미만이면 형식변경/최초 업로드로 판단한다. */
export function isSameFormat(matchRate: number): boolean {
  return matchRate >= FORMAT_MATCH_THRESHOLD;
}
