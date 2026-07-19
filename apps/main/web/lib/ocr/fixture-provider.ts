import type { OCRProvider, OCRResult, OCRTextBlock } from "./types";

// [T-2-2] E2E가 매 실행마다 유료 Google Vision API를 호출하지 않도록, 실제 관리비
// 고지서 사진(docs/sample/) 레이아웃을 단순화 재현한 결정적 OCR 결과를 반환하는 테스트
// 전용 provider(PM 확인, 2026-07-18). `__tests__/utility-bill-parse.test.ts`의
// sampleBillBlocks()와 같은 형태를 독립적으로 재구성 — lib은 __tests__를 import하지
// 않는다. `createOCRProvider()`가 `OCR_PROVIDER=fixture`일 때만 이 provider를 쓴다
// (playwright.config.ts의 webServer.env에서만 설정, 일반 dev/build/start에는 영향 없음).
const WORD_HEIGHT = 20;

function word(text: string, x: number, y: number, w = 50, h = WORD_HEIGHT): OCRTextBlock {
  return {
    text,
    boundingBox: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
  };
}

function fixtureBlocks(): OCRTextBlock[] {
  return [
    // 사용량별 지침표 — 전기/온수/수도/난방
    word("지침", 150, 50),
    word("전기", 20, 100, 30),
    word("36507", 90, 100, 60),
    word("36621", 190, 100, 60),
    word("114", 290, 100, 40),
    word("16,186", 370, 100, 60),
    word("온수", 20, 125, 30),
    word("447", 90, 125, 50),
    word("449", 190, 125, 50),
    word("2", 290, 125, 30),
    word("19,220", 370, 125, 60),
    word("수도", 20, 150, 30),
    word("852", 90, 150, 50),
    word("855", 190, 150, 50),
    word("5", 290, 150, 30),
    word("10,780", 370, 150, 60),
    word("난방", 20, 175, 30),
    word("1609", 90, 175, 50),
    word("1609", 190, 175, 50),

    // 관리비 상세표("부가세제외항목") — 2개 행
    word("부가세", 400, 500, 55),
    word("제외", 460, 500, 45),
    word("항목", 510, 500, 40),
    word("보험료", 340, 560, 55),
    word("2,550", 550, 560, 55),
    word("소독비", 340, 590, 55),
    word("640", 550, 590, 40),

    // 총액 + 청구월
    word("2026", 50, 800, 45),
    word("년", 100, 800, 20),
    word("07", 130, 800, 25),
    word("월", 160, 800, 20),
    word("납기", 50, 850, 45),
    word("내", 100, 850, 20),
    word("금액", 125, 850, 40),
    word("165,600", 250, 850, 65),
  ];
}

export class FixtureOCRProvider implements OCRProvider {
  readonly name = "fixture";

  async extractText(): Promise<OCRResult> {
    const blocks = fixtureBlocks();
    return { fullText: blocks.map((b) => b.text).join(" "), blocks };
  }
}
