import type { OCRResult, OCRTextBlock } from "@/lib/ocr";

// [2026-07-13] 실제 폰카메라 사진(docs/sample/) 실측 검증 결과 반영.
// 관리비 고지서는 한 장에 여러 구역(명세서/영수증 등)이 나란히 배치된 다열 문서라,
// 좌표 기하학적 휴리스틱만으로는 열이 섞이는 문제가 있었음 — 대신 특정 문구를
// 앵커로 찾아 그 주변 좌표 범위(가상의 크롭)로 좁힌 뒤 단순 파싱을 적용하는 방식으로
// 사용량별 지침표 4/4, 관리비 상세표 6/6, 총액+월 전부 정확히 추출됨을 확인.
//
// [2026-07-14] 다른 청구월 실사진 재검토에서 두 가지 결함 발견 후 수정: (1) "부가세항목"
// (과세 대상 열)이 앵커 없이 통째로 누락되고 있었음 — "부가세제외항목"과 나란히 두 번째
// 앵커로 추가하고, 두 앵커가 동시에 있으면 x좌표 중간선으로 좌우 범위를 나눠 서로
// 침범/중복 추출되지 않게 함. (2) "관리비차감"처럼 음수(차감) 금액이 AMOUNT_TOKEN 정규식에
// 걸려 전부 누락되고 있었음 — 부호를 허용하도록 수정. 표 행 수도 6행 가정에서 7행(관리비
// 차감 포함)까지 여유를 늘림.
//
// 아래 앵커 문구("부가세제외항목" 등)는 이번 검증에 쓰인 샘플(목동현대파리지앙) 양식에
// 맞춰진 값이다 — 다른 관리사무소 양식에서는 안 통할 수 있다. 재업로드(동일 사용자,
// 동일 양식 반복) 케이스를 우선 지원하기 위해 "현재 알려진 양식 고정값"으로 두고
// 진행하며, 사용자별 학습 라벨 기반 앵커로 일반화하는 것과 최초 업로드 크롭 UI는
// `docs/백로그.md` B-13에 기록.

export interface UsageTableRow {
  item: string;
  meterPrevious: number | null;
  meterCurrent: number | null;
  usageValue: number | null;
  usageAmount: number | null;
}

// 명세서 원본의 표 구획을 그대로 옮긴 값 — 미리보기 화면에서 원본처럼 구획별 표+소계로
// 묶어 보여주기 위함(2026-07-14, PM 요청). "부가세항목"/"부가세제외항목"은 원본의
// 2열 표 헤더 그대로이고, "전기·수도료"는 그 아래 별도 구역(전기/수도 세대·공동 요금 +
// 부가세)을 묶은 이름이다.
export const UTILITY_BILL_SECTIONS = ["부가세항목", "부가세제외항목", "전기·수도료"] as const;
export type UtilityBillItemSection = (typeof UTILITY_BILL_SECTIONS)[number];

export interface UtilityBillItemCandidate {
  label: string;
  amount: number;
  section: UtilityBillItemSection;
}

export interface UtilityBillExtraction {
  period: string | null;
  total: number | null;
  usageTable: UsageTableRow[];
  items: UtilityBillItemCandidate[];
}

const USAGE_TABLE_TITLE = "지침";
const USAGE_ITEMS = ["전기", "온수", "수도", "난방", "가스"];
// 관리비 상세표는 "부가세항목"(과세 대상)/"부가세제외항목"(비과세) 두 열이 나란히
// 배치된다 — 두 열 모두 앵커로 잡아야 왼쪽 열("부가세항목")이 누락되지 않는다
// (2026-07-14 실사진 재검토에서 왼쪽 열 전체 미추출 확인).
const ITEM_TABLE_HEADERS: UtilityBillItemSection[] = ["부가세항목", "부가세제외항목"];
const TOTAL_LABEL = "납기내금액";
const PERIOD_PATTERN = /(\d{4})\s*년\s*(\d{1,2})\s*월/;

// "관리비차감"처럼 음수(차감) 항목이 있어 부호를 허용한다(2026-07-14 실사진 재검토에서
// 음수 항목이 전부 누락되는 것을 확인). 마침표(.)도 허용하는 이유: OCR이 "42,440"의
// 쉼표를 마침표로 잘못 읽는 경우가 실사진에서 확인됨(관리비 금액은 항상 정수 원 단위라
// 마침표를 쉼표와 동일하게 취급해도 안전) — digitsOnly()가 어차피 구분자를 다 제거하므로
// 파싱 결과에는 영향 없음.
const AMOUNT_TOKEN = /^-?[\d][\d,.]*원?$/;
// 최소 자릿수 — 라벨 옆 잡음 숫자(동/호수 조각 등)를 금액으로 오인하지 않기 위한
// 최소한의 방어선. 원래 3이었는데 실사진에서 "공동수도료(오) 60원"처럼 정말 2자리
// 금액이 있는 것을 확인해(2026-07-14) 2로 낮췄다 — 1자리까지 낮추면 오탐 위험이 커져
// 2까지만 허용한다.
const MIN_AMOUNT_DIGITS = 2;
// 숫자/쉼표/마침표/"원"/"-" 토큰 병합 대상 판별용 — 실사진에서 "165" "," "600"처럼 한
// 금액이 여러 단어로 쪼개지는 경우가 있어(2026-07-13 실사진 검증), 병합 전에 먼저 이
// 토큰들만 골라낸다. "-"도 별도 토큰으로 분리되는 경우가 있어 포함한다.
const NUMERIC_FRAGMENT = /^[\d,.]+$|^원$|^-$/;

function digitsOnly(text: string): string {
  return text.replace(/[^\d]/g, "");
}

function parseAmount(text: string): number {
  const value = Number(digitsOnly(text));
  return text.startsWith("-") ? -value : value;
}

function yCenter(block: OCRTextBlock): number {
  const ys = block.boundingBox.map((v) => v.y);
  return (Math.min(...ys) + Math.max(...ys)) / 2;
}

function height(block: OCRTextBlock): number {
  const ys = block.boundingBox.map((v) => v.y);
  return Math.max(...ys) - Math.min(...ys) || 1;
}

function xLeft(block: OCRTextBlock): number {
  return Math.min(...block.boundingBox.map((v) => v.x));
}

function xRight(block: OCRTextBlock): number {
  return Math.max(...block.boundingBox.map((v) => v.x));
}

// 기하학적으로 인접한(gap이 작은) 숫자/쉼표/"원" 토큰만 하나로 합친다. 단순히 같은 줄에
// 있다고 다 합치면, 근처의 무관한 숫자(다른 칸의 값)까지 잘못 붙는 문제가 실사진
// 재검증에서 발견되어(2026-07-13) X 간격 조건을 추가했다.
//
// [2026-07-14] 임계값을 height*1.5 → height*0.7로 낮춤: 실사진 재검토에서 "36507"/
// "36621"(사용량표 전월/당월, 서로 다른 칸)의 실측 간격이 25px(글자 높이 17px, 비율
// 1.47배)로 기존 1.5배 임계값에 근접해 하나의 숫자로 잘못 합쳐지는 것을 확인. 반면 진짜
// 분리된 금액 조각(쉼표/부호 등)은 실측상 간격이 거의 0에 가까워(비율 0.1~0.2배)
// 0.7배로 낮춰도 안전하게 구분된다.
function mergeNumericFragments(line: OCRTextBlock[]): OCRTextBlock[] {
  const merged: OCRTextBlock[] = [];
  let i = 0;

  while (i < line.length) {
    const current = line[i];
    if (!current) {
      i++;
      continue;
    }
    if (!NUMERIC_FRAGMENT.test(current.text)) {
      merged.push(current);
      i++;
      continue;
    }

    let j = i;
    let text = current.text;
    const boundingBox: { x: number; y: number }[] = [...current.boundingBox];
    while (j + 1 < line.length) {
      const next = line[j + 1];
      if (!next || !NUMERIC_FRAGMENT.test(next.text)) break;
      const gap = xLeft(next) - xRight(line[j]!);
      if (gap > height(line[j]!) * 0.7) break; // 너무 멀면 별개 숫자로 취급
      text += next.text;
      boundingBox.push(...next.boundingBox);
      j++;
    }
    merged.push({
      text,
      boundingBox,
      ...(current.regionId !== undefined ? { regionId: current.regionId } : {}),
    });
    i = j + 1;
  }

  return merged;
}

function groupIntoLines(blocks: OCRTextBlock[]): OCRTextBlock[][] {
  const sorted = [...blocks].sort((a, b) => yCenter(a) - yCenter(b));
  const lines: OCRTextBlock[][] = [];

  for (const block of sorted) {
    const last = lines[lines.length - 1];
    if (last && last[0]) {
      const lineYCenter = last.reduce((sum, b) => sum + yCenter(b), 0) / last.length;
      if (Math.abs(yCenter(block) - lineYCenter) <= height(block) * 0.7) {
        last.push(block);
        continue;
      }
    }
    lines.push([block]);
  }

  return lines.map((line) => mergeNumericFragments([...line].sort((a, b) => xLeft(a) - xLeft(b))));
}

function findExactWord(blocks: OCRTextBlock[], text: string): OCRTextBlock | null {
  return blocks.find((b) => b.text === text) ?? null;
}

// 인접 단어를 이어붙여 phrase를 포함하는 연속 구간을 찾는다(예: "부가세"+"제외"+"항목" →
// "부가세제외항목"). OCR이 문구를 여러 단어로 쪼개는 경우가 많아 필요하다.
//
// [2026-07-14] 정확히 일치(===)에서 부분 문자열 포함(includes)으로 완화 — 같은 양식의
// 다른 청구월 실사진에서 Vision이 "기"+"공동"+"료"가 아니라 "기공"+"동"+"료"로 다르게
// 토큰을 쪼개는 것을 확인했다. "공동료"를 찾을 때 정확히 어느 토큰에서 시작하든("기공"
// 토큰 중간부터 시작해도) 이어붙인 문자열에 phrase가 포함되기만 하면 찾도록 해서, 토큰
// 경계가 문구 경계와 안 맞는 경우에도 안정적으로 매칭한다.
//
// matchIndex < blocks[i].text.length 조건이 중요하다 — 이게 없으면 "2026" "년" "01" "월"
// 처럼 phrase와 무관한 앞쪽 텍스트까지 이어붙였을 때 우연히 그 뒤에 진짜 phrase가 붙어
// 있으면(예: "…01월" 바로 뒤에 "납기내금액"이 나오는 경우) i가 그 무관한 텍스트 위치에서
// 시작해도 매칭돼버려 완전히 엉뚱한 좌표(anchor[0]의 y좌표)를 앵커로 잡는 문제가 있었다
// (실사진이 아니라 합성 테스트 픽스처에서 발견). phrase의 시작 지점이 "현재 토큰 안"에
// 있어야만 인정해서, i가 계속 다음 토큰으로 넘어가며 진짜 시작 토큰을 찾게 한다.
// excludeNext: 매칭 바로 다음 단어가 이 목록 중 하나로 시작하면 그 매칭은 건너뛴다 —
// "부가세"만 단독으로 찾을 때 "부가세항목"/"부가세제외항목" 헤더(부가세+항목/제외로
// 이어지는 긴 문구)와 헷갈리지 않게 하기 위함(2026-07-14).
function findPhraseAnchor(
  blocks: OCRTextBlock[],
  phrase: string,
  excludeNext: string[] = []
): OCRTextBlock[] | null {
  const maxLen = phrase.length + 6;
  for (let i = 0; i < blocks.length; i++) {
    let acc = "";
    let j = i;
    while (j < blocks.length && acc.length < maxLen) {
      acc += blocks[j]!.text;
      j++;
      const matchIndex = acc.indexOf(phrase);
      if (matchIndex === -1 || matchIndex >= blocks[i]!.text.length) continue;
      const next = blocks[j];
      if (next && excludeNext.some((t) => next.text.startsWith(t))) break;
      return blocks.slice(i, j);
    }
  }
  return null;
}

// 사용량별 지침표: 항목명(전기/온수/수도/난방/가스)을 직접 앵커로 찾아, 같은 줄의
// 숫자를 순서대로 [전월, 당월, 사용량, 사용요금]에 배정한다. 표 제목("지침") 좌표
// 기준으로 좁은 범위만 검색해, 공지사항 등 다른 구역에 우연히 같은 글자가 나와도
// 섞이지 않게 한다.
function extractUsageTable(blocks: OCRTextBlock[]): UsageTableRow[] {
  const title = findExactWord(blocks, USAGE_TABLE_TITLE);
  if (!title) return [];

  const titleHeight = height(title);
  const yMin = yCenter(title);
  const yMax = yMin + titleHeight * 15; // 표 높이 추정치(행 4~5개)
  const xMin = 0;
  const xMax = xLeft(title) + titleHeight * 10; // 표 너비 추정치

  const rows: UsageTableRow[] = [];
  for (const block of blocks) {
    if (!USAGE_ITEMS.includes(block.text)) continue;
    const y = yCenter(block);
    const x = xLeft(block);
    if (y < yMin || y > yMax || x < xMin || x > xMax) continue;

    // 0.7 → 1.0: 실사진에서 같은 행의 맨 오른쪽 숫자(사용요금)가 사진 기울기 등으로
    // y좌표가 살짝 더 벌어져 0.1px 차이로 "같은 줄" 판정에서 빠지는 걸 확인했다
    // (2026-02 청구월 실사진, 2026-07-14) — 여유를 늘림.
    const sameLine = blocks
      .filter(
        (w) =>
          w !== block &&
          Math.abs(yCenter(w) - yCenter(block)) <= height(block) * 1.0 &&
          xLeft(w) > xLeft(block)
      )
      .sort((a, b) => xLeft(a) - xLeft(b));
    const numbers = mergeNumericFragments(sameLine)
      .filter((w) => /^[\d,]+$/.test(w.text))
      .map((w) => Number(digitsOnly(w.text)));

    rows.push({
      item: block.text,
      meterPrevious: numbers[0] ?? null,
      meterCurrent: numbers[1] ?? null,
      usageValue: numbers[2] ?? null,
      usageAmount: numbers[3] ?? null,
    });
  }
  return rows;
}

// 관리비 상세표 한 열(라벨:금액): 헤더 앵커 아래 좁은 좌표 범위(가상의 크롭)로
// 한정한 뒤, 검증된 단순 줄 그룹핑+금액 추출을 적용한다. xBounds는 인접한 다른 열과
// 겹치지 않도록 extractItemTable()이 앵커 간 중간선으로 미리 계산해 넘겨준다.
function extractItemTableForAnchor(
  blocks: OCRTextBlock[],
  anchor: OCRTextBlock[],
  xBounds: { min: number; max: number },
  section: UtilityBillItemSection
): UtilityBillItemCandidate[] {
  const anchorHeight = Math.max(...anchor.map(height));
  const anchorYBottom = Math.max(...anchor.map((w) => Math.max(...w.boundingBox.map((v) => v.y))));
  // 표 높이 추정치 — 기존 6행 기준(*11)에서 실사진 재검토(2026-07-14) 결과 7행(관리비차감
  // 포함)까지 확인되어 여유를 늘렸었는데, 또 다른 청구월 실사진에서 행 간격이 앵커
  // 높이 대비 더 넓어 "관리비차감" 행이 경계에서 1~2px 차이로 잘리는 것을 확인해(같은
  // 2026-07-14) 다시 늘림. xBounds(좌우 범위)가 이미 인접 열/하단 요약 구역 오염을
  // 막아주므로, 이 값을 넉넉히 늘려도 안전하다.
  const rowsWindow = anchorHeight * 16;

  const scoped = blocks.filter(
    (w) =>
      yCenter(w) > anchorYBottom &&
      yCenter(w) < anchorYBottom + rowsWindow &&
      xLeft(w) >= xBounds.min &&
      xLeft(w) <= xBounds.max
  );

  const lines = groupIntoLines(scoped);
  const candidates: UtilityBillItemCandidate[] = [];

  for (const line of lines) {
    let amountIdx = -1;
    for (let i = line.length - 1; i >= 0; i--) {
      const text = line[i]?.text;
      if (text === undefined) continue;
      if (AMOUNT_TOKEN.test(text) && digitsOnly(text).length >= MIN_AMOUNT_DIGITS) {
        amountIdx = i;
        break;
      }
    }
    if (amountIdx === -1) continue;

    const label = line
      .slice(0, amountIdx)
      .map((b) => b.text)
      .join(" ")
      .trim();
    if (!label) continue;

    candidates.push({ label, amount: parseAmount(line[amountIdx]!.text), section });
  }

  return candidates;
}

// 관리비 상세표: "부가세항목"/"부가세제외항목" 두 열을 각각 앵커로 찾아 추출한다. 두
// 앵커가 모두 있으면 서로의 영역을 침범하지 않도록 좌우 범위를 나눈다.
//
// [2026-07-14] 경계선을 "앵커 시작 좌표의 중간"이 아니라 "두 앵커 사이 간격의 중간"으로
// 계산하도록 수정. 헤더 문구는 열 안에서 왼쪽 정렬, 금액은 오른쪽 정렬이라 실사진에서
// 왼쪽 열의 데이터(금액)가 "헤더 시작 좌표 중간"보다 오른쪽으로 삐져나와 잘리는 문제를
// 확인했다 — 두 헤더 "사이 빈 간격"의 중간을 경계로 쓰면 각 열의 실제 데이터 폭까지
// 안정적으로 포함된다. columnTolerance도 3.6→4.5로 늘림(실측 결과 라벨이 헤더보다
// 왼쪽으로 더 멀리 시작하는 경우 확인).
function extractItemTable(blocks: OCRTextBlock[]): UtilityBillItemCandidate[] {
  const anchors = ITEM_TABLE_HEADERS.map((header) => ({
    section: header,
    anchor: findPhraseAnchor(blocks, header),
  })).filter(
    (a): a is { section: UtilityBillItemSection; anchor: OCRTextBlock[] } =>
      a.anchor !== null && a.anchor.length > 0
  );
  if (anchors.length === 0) return [];

  const candidates: UtilityBillItemCandidate[] = [];
  for (const { section, anchor } of anchors) {
    const anchorXMin = Math.min(...anchor.map(xLeft));
    const anchorXMax = Math.max(...anchor.map(xRight));
    const anchorHeight = Math.max(...anchor.map(height));
    // 4.5 → 7: 실사진(2026-02 청구월)에서 앵커 글자가 작아(anchorHeight 작음) 이 여유가
    // 부족해 라벨 앞글자가 잘리거나("일반관리비"→"관리비") 아예 통째로 빠지는
    // ("청소비") 문제를 확인했다(2026-07-14). 실제 라벨 시작 좌표가 헤더보다 왼쪽으로
    // 벌어지는 폭은 anchorHeight와 비례하지 않고 사진마다 들쭉날쭉해서, 곱수 자체를
    // 넉넉히 늘려 대응한다.
    let xMin = anchorXMin - anchorHeight * 7; // 실측 결과 데이터 열이 헤더보다 왼쪽으로 더 시작함
    let xMax = anchorXMax + anchorHeight * 11; // 표 너비 추정치

    for (const other of anchors) {
      if (other.anchor === anchor) continue;
      const otherXMin = Math.min(...other.anchor.map(xLeft));
      const otherXMax = Math.max(...other.anchor.map(xRight));
      if (otherXMin > anchorXMin) {
        xMax = Math.min(xMax, (anchorXMax + otherXMin) / 2);
      } else {
        xMin = Math.max(xMin, (anchorXMin + otherXMax) / 2);
      }
    }

    candidates.push(
      ...extractItemTableForAnchor(blocks, anchor, { min: xMin, max: xMax }, section)
    );
  }
  return candidates;
}

// 앵커 문구와 같은 줄, 오른쪽에서 가장 가까운 금액 토큰을 찾는다. "납기내금액" 총액
// 찾기(extractPeriodAndTotal)와 전기/수도 세부 요금 찾기(extractUtilityFeeItems)가
// 공통으로 쓰는 패턴이라 분리했다.
function findAmountRightOf(blocks: OCRTextBlock[], anchor: OCRTextBlock[]): number | null {
  const anchorY = yCenter(anchor[0]!);
  const anchorXRight = Math.max(...anchor.map(xRight));
  const sameLine = blocks
    .filter((w) => Math.abs(yCenter(w) - anchorY) <= height(w) * 0.7 && xLeft(w) > anchorXRight)
    .sort((a, b) => xLeft(a) - xLeft(b));
  const merged = mergeNumericFragments(sameLine);
  const amountWord = merged.find(
    (w) => AMOUNT_TOKEN.test(w.text) && digitsOnly(w.text).length >= MIN_AMOUNT_DIGITS
  );
  return amountWord ? parseAmount(amountWord.text) : null;
}

// 총액 + 청구월: "납기내금액" 문구를 앵커로 같은 줄 오른쪽의 금액을 찾고, 청구월은
// 사진 전체에서 "YYYY년 M월" 패턴을 정규식으로 찾는다 — 업로드 시점이 아니라 고지서에
// 인쇄된 청구월을 써야 한다(PM 지적, 관리비는 통상 1~2개월 후행 청구됨).
function extractPeriodAndTotal(blocks: OCRTextBlock[]): {
  period: string | null;
  total: number | null;
} {
  const fullText = blocks.map((b) => b.text).join(" ");
  const periodMatch = fullText.match(PERIOD_PATTERN);
  const period = periodMatch ? `${periodMatch[1]}-${periodMatch[2]!.padStart(2, "0")}` : null;

  const anchor = findPhraseAnchor(blocks, TOTAL_LABEL);
  const total = anchor && anchor.length > 0 ? findAmountRightOf(blocks, anchor) : null;

  return { period, total };
}

// 전기료/수도료 세부 내역(관리비 상세표 하단, "부가세항목"/"부가세제외항목"과 별도 구역):
// 전기·수도는 "세대분"(사용량 기반)과 "공동분"(공용 사용분)으로 나뉘어 표시된다.
// - 세대분은 사용량별 지침표(usageTable)의 사용요금과 정확히 같은 금액이 그대로 다시
//   인쇄되는 것을 실사진에서 확인했다(예: 전기 세대분 16,186원 = usageTable 전기
//   usageAmount) — 텍스트를 다시 취약하게 파싱하는 대신 이미 정확히 뽑아낸 usageTable
//   값을 그대로 재사용한다.
// - 공동분("전기료 공동" "수도료(공동)", 영수증 표기는 "공동수도료(오수)")과 "기본수도료"는
//   usageTable에 없는 별도 금액이라 각각 앵커로 찾는다. "기본수도료"는 PM 확인(2026-07-14)
//   결과 원본에서 "부가세제외항목" 열에 속해 그쪽 section으로 넣는다 — 전기·수도료
//   섹션에는 전기료(세대/공동)·수도료(세대/공동) 4개 + 부가세만 남는다.
// - "부가세"(공급가액에 대한 부가가치세, 실사진에서 165,600원 총액 중 항목 목록에
//   없던 잔차 5,244원의 대부분(5,240원)을 차지하는 것을 확인해 함께 추가한다. "부가세"
//   단독 문구는 "부가세항목"/"부가세제외항목" 헤더와 겹칠 수 있어, 바로 다음 단어가
//   "항목"/"제외"로 이어지는 매칭은 제외한다(findPhraseAnchor의 excludeNext).
// actions.ts의 저장 로직이 "이 items 항목이 usageTable의 어느 사용량 행에 대응하는지"
// 매칭할 때 재사용 — 문자열을 각자 하드코딩하면 라벨이 바뀔 때 저장 쪽만 누락되기 쉽다.
export const ELECTRICITY_SEDAE_LABEL = "전기료(세대)";
export const ELECTRICITY_GONGDONG_LABEL = "전기료(공동)";
export const WATER_SEDAE_LABEL = "수도료(세대)";
export const WATER_GONGDONG_LABEL = "수도료(공동)";
const VAT_HEADER_CONTINUATIONS = ["항목", "제외"];
const UTILITY_FEE_SECTION: UtilityBillItemSection = "전기·수도료";
const SUB_FEE_ANCHORS: {
  phrase: string;
  label: string;
  section: UtilityBillItemSection;
  excludeNext?: string[];
}[] = [
  { phrase: "공동료", label: ELECTRICITY_GONGDONG_LABEL, section: UTILITY_FEE_SECTION },
  { phrase: "기본수도료", label: "기본수도료", section: "부가세제외항목" },
  { phrase: "공동수도료", label: WATER_GONGDONG_LABEL, section: UTILITY_FEE_SECTION },
  {
    phrase: "부가세",
    label: "부가세",
    section: UTILITY_FEE_SECTION,
    excludeNext: VAT_HEADER_CONTINUATIONS,
  },
];

function extractUtilityFeeItems(
  blocks: OCRTextBlock[],
  usageTable: UsageTableRow[]
): UtilityBillItemCandidate[] {
  const items: UtilityBillItemCandidate[] = [];

  const electricity = usageTable.find((u) => u.item === "전기");
  if (electricity?.usageAmount != null) {
    items.push({
      label: ELECTRICITY_SEDAE_LABEL,
      amount: electricity.usageAmount,
      section: UTILITY_FEE_SECTION,
    });
  }
  const water = usageTable.find((u) => u.item === "수도");
  if (water?.usageAmount != null) {
    items.push({
      label: WATER_SEDAE_LABEL,
      amount: water.usageAmount,
      section: UTILITY_FEE_SECTION,
    });
  }

  for (const { phrase, label, section, excludeNext } of SUB_FEE_ANCHORS) {
    const anchor = findPhraseAnchor(blocks, phrase, excludeNext);
    if (!anchor || anchor.length === 0) continue;
    const amount = findAmountRightOf(blocks, anchor);
    if (amount != null) items.push({ label, amount, section });
  }

  return items;
}

// "기본수도료"/"공동수도료" 같은 SUB_FEE_ANCHORS 라벨은 rowsWindow가 넓어지면서
// (2026-07-14, 관리비차감 잘림 수정) extractItemTable의 일반 표 스캔에도 같이 걸릴 수
// 있다 — 이미 SUB_FEE_ANCHORS가 전담 앵커로 정확히 뽑아내므로, 일반 표 스캔 쪽 결과는
// 같은 라벨이면 중복으로 보고 제외한다. OCR이 라벨 사이에 공백을 넣는 경우가 있어
// 공백을 지우고 비교한다(예: "기본 수도료" vs "기본수도료").
const SUB_FEE_LABELS = new Set(SUB_FEE_ANCHORS.map(({ phrase }) => phrase));

/**
 * 관리비 명세서 사진에서 사용량별 지침표 + 관리비 상세표 + 총액/청구월을 추출한다.
 * 항목 선정 화면(F-2-2-1)에서 사용자가 최종 확인/수정하므로, 이 단계는 후보만 만들면
 * 된다 — 완벽할 필요는 없다.
 */
export function extractUtilityBill(result: OCRResult): UtilityBillExtraction {
  const { blocks } = result;
  const { period, total } = extractPeriodAndTotal(blocks);
  const usageTable = extractUsageTable(blocks);
  const tableItems = extractItemTable(blocks).filter(
    (item) => !SUB_FEE_LABELS.has(item.label.replace(/\s+/g, ""))
  );
  return {
    period,
    total,
    usageTable,
    items: [...tableItems, ...extractUtilityFeeItems(blocks, usageTable)],
  };
}
