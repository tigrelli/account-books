// OCR 엔진 교체/병행 사용을 위한 추상화(PM 결정, 2026-07-13). GoogleVisionProvider가
// 첫 구현체이고, 이후 PaddleOCRProvider 등을 이 인터페이스로 추가할 수 있다.
// 라벨/금액 매칭 같은 도메인 로직은 이 레이어에 두지 않는다(S-2-8 몫) — 여기서는
// 원본 텍스트+좌표만 provider 중립적인 형태로 반환한다.

export interface OCRTextBlock {
  text: string;
  // 이미지 픽셀 좌표계의 폴리곤 꼭짓점(보통 4개). 엔진마다 좌표 방식이 조금씩 달라도
  // 이 형태로만 맞추면 상위 로직(라벨/금액 매칭)은 provider를 몰라도 된다.
  boundingBox: { x: number; y: number }[];
  // 같은 시각적 영역(문단/블록)에 속한 단어 묶음 식별자. 관리비 고지서처럼 여러 구역이
  // 나란히 배치된(다열) 문서에서, y좌표만으로 줄을 묶으면 서로 다른 구역의 텍스트가
  // 섞이는 문제가 실사진 검증(S-2-8, 2026-07-13)에서 확인되어 추가함 — 상위 로직이 같은
  // regionId 안에서만 줄을 묶도록 함. provider가 영역 구분을 지원하지 않으면 undefined
  // (이 경우 상위 로직은 전체를 한 구역으로 취급).
  regionId?: number;
}

export interface OCRResult {
  fullText: string;
  blocks: OCRTextBlock[];
}

export interface OCRProvider {
  readonly name: string;
  extractText(image: Buffer): Promise<OCRResult>;
}
