// 모바일 "더보기"(무한 스크롤)용 키셋 커서 인코딩/디코딩 — offset(.range())은 스크롤 중 새 지출이
// 추가되면 다음 배치가 밀려 항목이 중복되거나 누락될 수 있어, 정렬 기준(occurred_at desc, id desc)의
// 마지막 값 자체를 커서로 사용한다. Supabase 의존이 없는 순수 함수라 서버(Route Handler)와
// 클라이언트(초기 데이터에서 다음 커서 미리 계산) 양쪽에서 그대로 재사용한다.
export type ExpenseCursor = {
  occurredAt: string;
  id: string;
};

// occurred_at(ISO 타임스탬프)과 id(UUID) 모두 "|"를 포함하지 않으므로 구분자로 안전하게 쓸 수
// 있음 — Buffer/btoa 같은 런타임별 API 없이 순수 문자열 연산만으로 클라이언트/서버 어디서든 동작.
export function encodeExpenseCursor(cursor: ExpenseCursor): string {
  return `${cursor.occurredAt}|${cursor.id}`;
}

export function decodeExpenseCursor(encoded: string): ExpenseCursor {
  const [occurredAt, id] = encoded.split("|");
  if (!occurredAt || !id) throw new Error("잘못된 커서 형식입니다");
  return { occurredAt, id };
}
