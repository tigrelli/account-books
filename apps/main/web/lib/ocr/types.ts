// OCR 엔진 교체/병행 사용을 위한 추상화(PM 결정, 2026-07-13). GoogleVisionProvider가
// 첫 구현체이고, 이후 PaddleOCRProvider 등을 이 인터페이스로 추가할 수 있다.
// 라벨/금액 매칭 같은 도메인 로직은 이 레이어에 두지 않는다(S-2-8 몫) — 여기서는
// 원본 텍스트+좌표만 provider 중립적인 형태로 반환한다.

export interface OCRTextBlock {
  text: string;
  // 이미지 픽셀 좌표계의 폴리곤 꼭짓점(보통 4개). 엔진마다 좌표 방식이 조금씩 달라도
  // 이 형태로만 맞추면 상위 로직(라벨/금액 매칭)은 provider를 몰라도 된다.
  boundingBox: { x: number; y: number }[];
}

export interface OCRResult {
  fullText: string;
  blocks: OCRTextBlock[];
}

export interface OCRProvider {
  readonly name: string;
  extractText(image: Buffer): Promise<OCRResult>;
}
