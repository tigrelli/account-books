import type { OCRProvider, OCRResult, OCRTextBlock } from "./types";

const VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate";

interface VisionVertex {
  x?: number;
  y?: number;
}

interface VisionSymbol {
  text: string;
}

interface VisionWord {
  boundingBox?: { vertices?: VisionVertex[] };
  symbols: VisionSymbol[];
}

interface VisionParagraph {
  words: VisionWord[];
}

interface VisionBlock {
  paragraphs: VisionParagraph[];
}

interface VisionPage {
  blocks: VisionBlock[];
}

interface VisionFullTextAnnotation {
  text: string;
  pages: VisionPage[];
}

interface VisionAnnotateResponse {
  responses: {
    fullTextAnnotation?: VisionFullTextAnnotation;
    error?: { message: string };
  }[];
}

// REST 직접 호출(@google-cloud/vision SDK 미사용) — API 키 하나로 끝나는 요청이라
// SDK 없이 fetch로 충분하고, 새 npm 패키지 추가를 피할 수 있다(CLAUDE.md 원칙).
export class GoogleVisionProvider implements OCRProvider {
  readonly name = "google-vision";

  constructor(private readonly apiKey: string) {}

  async extractText(image: Buffer): Promise<OCRResult> {
    const response = await fetch(`${VISION_API_URL}?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: image.toString("base64") },
            // 관리비 고지서는 여러 구역(명세서/고지서/영수증 등)이 나란히 배치된 다열
            // 문서라 TEXT_DETECTION(희소 텍스트용)이 아니라 문서 레이아웃을 블록 단위로
            // 분석하는 DOCUMENT_TEXT_DETECTION을 쓴다 — 실사진 검증(2026-07-13)에서
            // 단순 y좌표 그룹핑만으로는 서로 다른 구역 텍스트가 섞이는 문제를 확인했다.
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Vision API 호출 실패: ${response.status}`);
    }

    const data = (await response.json()) as VisionAnnotateResponse;
    const result = data.responses[0];

    if (result?.error) {
      throw new Error(`Google Vision API 오류: ${result.error.message}`);
    }

    const blocks: OCRTextBlock[] = [];
    let regionId = 0;

    for (const page of result?.fullTextAnnotation?.pages ?? []) {
      for (const block of page.blocks) {
        for (const paragraph of block.paragraphs) {
          for (const word of paragraph.words) {
            blocks.push({
              text: word.symbols.map((s) => s.text).join(""),
              boundingBox: (word.boundingBox?.vertices ?? []).map((v) => ({
                x: v.x ?? 0,
                y: v.y ?? 0,
              })),
              regionId,
            });
          }
        }
        // 블록 단위로 구역을 구분한다(문단 단위는 표 한 행/한 셀처럼 너무 잘게 쪼갤 수
        // 있어, 다열 구역 분리에는 블록 단위가 더 안전하다는 판단).
        regionId++;
      }
    }

    return {
      fullText: result?.fullTextAnnotation?.text ?? "",
      blocks,
    };
  }
}
