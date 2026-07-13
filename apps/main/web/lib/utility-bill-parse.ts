import type { OCRResult, OCRTextBlock } from "@/lib/ocr";

export interface UtilityBillLineCandidate {
  label: string;
  amount: number;
  rawLine: string;
}

// 금액 토큰: 쉼표 포함 숫자 + 선택적 "원", 최소 3자리(100원 미만 오탐 방지 — 관리비 고지서
// 항목 금액은 보통 수천원 이상).
const AMOUNT_TOKEN = /^[\d][\d,]*원?$/;
const MIN_AMOUNT_DIGITS = 3;

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

// 단어 단위 bounding box를 y좌표 근접도로 같은 줄로 묶는다(관리비 고지서는 표 형태라
// 항목명과 금액이 같은 줄에 나란히 있다는 전제 — 실제 고지서로 재검증 필요, §7 TBD).
function groupIntoLines(blocks: OCRTextBlock[]): OCRTextBlock[][] {
  const sorted = [...blocks].sort((a, b) => yCenter(a) - yCenter(b));
  const lines: OCRTextBlock[][] = [];

  for (const block of sorted) {
    const last = lines[lines.length - 1];
    if (last) {
      const lineYCenter = last.reduce((sum, b) => sum + yCenter(b), 0) / last.length;
      const tolerance = height(block) * 0.7;
      if (Math.abs(yCenter(block) - lineYCenter) <= tolerance) {
        last.push(block);
        continue;
      }
    }
    lines.push([block]);
  }

  return lines.map((line) => [...line].sort((a, b) => xLeft(a) - xLeft(b)));
}

function extractAmount(line: OCRTextBlock[]): { amount: number; amountFrom: number } | null {
  for (let i = line.length - 1; i >= 0; i--) {
    const text = line[i]?.text;
    if (text === undefined) continue;

    if (AMOUNT_TOKEN.test(text) && digitsOnly(text).length >= MIN_AMOUNT_DIGITS) {
      return { amount: Number(digitsOnly(text)), amountFrom: i };
    }

    // "45,320"과 "원"이 별도 단어로 분리된 경우
    if (text === "원" && i > 0) {
      const prev = line[i - 1]?.text;
      if (prev && /^[\d,]+$/.test(prev) && digitsOnly(prev).length >= MIN_AMOUNT_DIGITS) {
        return { amount: Number(digitsOnly(prev)), amountFrom: i - 1 };
      }
    }
  }
  return null;
}

/**
 * OCR 원본 텍스트+좌표에서 "라벨 + 금액" 후보를 줄 단위로 추출한다.
 * 매칭 실패(금액 없는 줄 — 헤더/주소 등)는 조용히 건너뛴다. 형식변경 판별(S-2-9)과
 * 항목 선정 화면(F-2-2-1)에서 이 결과를 사용자에게 보여주고 최종 확정은 사람이 한다 —
 * 여기서는 후보만 만들면 된다.
 */
export function parseUtilityBillCandidates(result: OCRResult): UtilityBillLineCandidate[] {
  const lines = groupIntoLines(result.blocks);
  const candidates: UtilityBillLineCandidate[] = [];

  for (const line of lines) {
    const found = extractAmount(line);
    if (!found) continue;

    const label = line
      .slice(0, found.amountFrom)
      .map((b) => b.text)
      .join(" ")
      .trim();

    if (!label) continue;

    candidates.push({
      label,
      amount: found.amount,
      rawLine: line.map((b) => b.text).join(" "),
    });
  }

  return candidates;
}
