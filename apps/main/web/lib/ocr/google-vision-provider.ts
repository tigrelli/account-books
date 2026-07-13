import type { OCRProvider, OCRResult, OCRTextBlock } from "./types";

const VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate";

interface VisionVertex {
  x?: number;
  y?: number;
}

interface VisionTextAnnotation {
  description: string;
  boundingPoly: { vertices: VisionVertex[] };
}

interface VisionAnnotateResponse {
  responses: {
    textAnnotations?: VisionTextAnnotation[];
    error?: { message: string };
  }[];
}

// REST 직접 호출(@google-cloud/vision SDK 미사용) — API 키 하나로 끝나는 단순 텍스트
// 감지라 SDK 없이 fetch로 충분하고, 새 npm 패키지 추가를 피할 수 있다(CLAUDE.md 원칙).
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
            // 관리비 고지서는 표 형태의 조밀한 문서라 DOCUMENT_TEXT_DETECTION이 더 적합할
            // 수 있으나, 좌표 반환 여부 확인이 목적인 S-2-7 PoC에서는 파싱이 단순한
            // TEXT_DETECTION으로 우선 검증하고, 실제 정확도 튜닝은 S-2-8/9에서 재검토한다.
            features: [{ type: "TEXT_DETECTION" }],
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

    // textAnnotations[0]은 전체 텍스트, 이후 항목이 단어별 텍스트+좌표.
    const [full, ...words] = result?.textAnnotations ?? [];

    const blocks: OCRTextBlock[] = words.map((word) => ({
      text: word.description,
      boundingBox: (word.boundingPoly.vertices ?? []).map((v) => ({
        x: v.x ?? 0,
        y: v.y ?? 0,
      })),
    }));

    return {
      fullText: full?.description ?? "",
      blocks,
    };
  }
}
