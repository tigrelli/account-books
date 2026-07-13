import type { OCRResult, OCRTextBlock } from "@/lib/ocr";

// [2026-07-13] 실제 폰카메라 사진(docs/sample/) 실측 검증 결과 반영.
// 관리비 고지서는 한 장에 여러 구역(명세서/영수증 등)이 나란히 배치된 다열 문서라,
// 좌표 기하학적 휴리스틱만으로는 열이 섞이는 문제가 있었음 — 대신 특정 문구를
// 앵커로 찾아 그 주변 좌표 범위(가상의 크롭)로 좁힌 뒤 단순 파싱을 적용하는 방식으로
// 사용량별 지침표 4/4, 관리비 상세표 6/6, 총액+월 전부 정확히 추출됨을 확인.
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

export interface UtilityBillItemCandidate {
  label: string;
  amount: number;
}

export interface UtilityBillExtraction {
  period: string | null;
  total: number | null;
  usageTable: UsageTableRow[];
  items: UtilityBillItemCandidate[];
}

const USAGE_TABLE_TITLE = "지침";
const USAGE_ITEMS = ["전기", "온수", "수도", "난방", "가스"];
const ITEM_TABLE_HEADER = "부가세제외항목";
const TOTAL_LABEL = "납기내금액";
const PERIOD_PATTERN = /(\d{4})\s*년\s*(\d{1,2})\s*월/;

const AMOUNT_TOKEN = /^[\d][\d,]*원?$/;
const MIN_AMOUNT_DIGITS = 3;
// 숫자/쉼표/"원" 토큰 병합 대상 판별용 — 실사진에서 "165" "," "600"처럼 한 금액이
// 여러 단어로 쪼개지는 경우가 있어(2026-07-13 실사진 검증), 병합 전에 먼저 이 토큰들만
// 골라낸다.
const NUMERIC_FRAGMENT = /^[\d,]+$|^원$/;

function digitsOnly(text: string): string {
  return text.replace(/[^\d]/g, "");
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
      if (gap > height(line[j]!) * 1.5) break; // 너무 멀면 별개 숫자로 취급
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

// 인접 단어를 이어붙여 phrase와 정확히 일치하는 연속 구간을 찾는다(예: "부가세"+"제외"+
// "항목" → "부가세제외항목"). OCR이 문구를 여러 단어로 쪼개는 경우가 많아 필요하다.
function findPhraseAnchor(blocks: OCRTextBlock[], phrase: string): OCRTextBlock[] | null {
  for (let i = 0; i < blocks.length; i++) {
    let acc = "";
    let j = i;
    while (j < blocks.length && acc.length < phrase.length) {
      acc += blocks[j]!.text;
      j++;
    }
    if (acc === phrase) return blocks.slice(i, j);
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

    const sameLine = blocks
      .filter(
        (w) =>
          w !== block &&
          Math.abs(yCenter(w) - yCenter(block)) <= height(block) * 0.7 &&
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

// 관리비 상세표(라벨:금액): 헤더 문구를 앵커로 찾아 그 아래 좁은 좌표 범위(가상의
// 크롭)로 한정한 뒤, 검증된 단순 줄 그룹핑+금액 추출을 적용한다.
function extractItemTable(blocks: OCRTextBlock[]): UtilityBillItemCandidate[] {
  const anchor = findPhraseAnchor(blocks, ITEM_TABLE_HEADER);
  if (!anchor || anchor.length === 0) return [];

  const anchorHeight = Math.max(...anchor.map(height));
  const anchorX = Math.min(...anchor.map(xLeft));
  const anchorYBottom = Math.max(...anchor.map((w) => Math.max(...w.boundingBox.map((v) => v.y))));
  const columnTolerance = anchorHeight * 3.6; // 실측 결과 데이터 열이 헤더보다 왼쪽으로 더 시작함
  const rowsWindow = anchorHeight * 11; // 표 높이 추정치
  const columnWidth = anchorHeight * 11; // 표 너비 추정치

  const scoped = blocks.filter(
    (w) =>
      yCenter(w) > anchorYBottom &&
      yCenter(w) < anchorYBottom + rowsWindow &&
      xLeft(w) >= anchorX - columnTolerance &&
      xLeft(w) <= anchorX + columnWidth
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

    candidates.push({ label, amount: Number(digitsOnly(line[amountIdx]!.text)) });
  }

  return candidates;
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
  let total: number | null = null;
  if (anchor && anchor.length > 0) {
    const anchorY = yCenter(anchor[0]!);
    const anchorXRight = Math.max(...anchor.map(xRight));
    const sameLine = blocks
      .filter((w) => Math.abs(yCenter(w) - anchorY) <= height(w) * 0.7 && xLeft(w) > anchorXRight)
      .sort((a, b) => xLeft(a) - xLeft(b));
    const merged = mergeNumericFragments(sameLine);
    const amountWord = merged.find(
      (w) => AMOUNT_TOKEN.test(w.text) && digitsOnly(w.text).length >= MIN_AMOUNT_DIGITS
    );
    if (amountWord) total = Number(digitsOnly(amountWord.text));
  }

  return { period, total };
}

/**
 * 관리비 명세서 사진에서 사용량별 지침표 + 관리비 상세표 + 총액/청구월을 추출한다.
 * 항목 선정 화면(F-2-2-1)에서 사용자가 최종 확인/수정하므로, 이 단계는 후보만 만들면
 * 된다 — 완벽할 필요는 없다.
 */
export function extractUtilityBill(result: OCRResult): UtilityBillExtraction {
  const { blocks } = result;
  const { period, total } = extractPeriodAndTotal(blocks);
  return {
    period,
    total,
    usageTable: extractUsageTable(blocks),
    items: extractItemTable(blocks),
  };
}
