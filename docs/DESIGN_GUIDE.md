# payLens 디자인 가이드 (v1.0)

> 확정 BI: **Refined Navy with Gold Accent**
> 본 문서는 `paylens_design_guide.pdf` 원본을 개발 참조용으로 재구성한 문서입니다.

## 1. 브랜드 코어 콘셉트

| 키워드  | 설명                                    |
| ------- | --------------------------------------- |
| Focus   | 가장 중요한 지출 흐름을 짚어냄          |
| Clarity | 차트/도표로 자산 흐름을 투명하게 시각화 |
| Growth  | 지출 분석을 통한 자산 우상향 도모       |
| Insight | AI 기반 소비 인사이트 제공              |

## 2. 로고 가이드

- **Full Logo**: 심볼 + `payLens` + 서브타이틀 `TRUSTED EXPENSE ANALYSIS` 수직 결합
- **Icon Only**: 네이비 원형 배경 + 심볼마크만 (앱 아이콘, 파비콘, 프로필)
- **Clear Space**: 심볼 크기의 최소 20% 여백 확보
- 심볼 모티프: 돋보기(Lens) + 신용카드 + 동전 탑 + 돈자루

## 3. 컬러 시스템

| 토큰명         | 변수명                   | HEX       | RGB         | 용도                                                              |
| -------------- | ------------------------ | --------- | ----------- | ----------------------------------------------------------------- |
| Deep Navy      | `--color-paylens-main`   | `#0B2545` | 11,37,69    | 메인 브랜드 컬러, 헤더, 주 타이포, 로고                           |
| True Navy      | `--color-paylens-sub`    | `#134074` | 19,64,116   | 서브타이틀, 활성 메뉴탭, 컴포넌트 테두리                          |
| Data Accent    | `--color-paylens-accent` | `#EE6C4D` | 238,108,77  | **데이터 강조**: 지출 경고, 트렌드 차트, 마이너스 금액, 예산 초과 |
| Data Soft      | `--color-data-soft`      | `#EA580C` | 234,88,12   | **보조 데이터**: 중립 배지(▼), 잔여 예산 바, 현금/자동이체 태그   |
| Action Teal    | `--color-action`         | `#0D9488` | 13,148,136  | **UI 액션**: CTA 버튼, 링크, 사이드바 활성 탭 인디케이터          |
| Data Gray      | `--color-paylens-bg`     | `#F8FAFC` | 248,250,252 | 전체 배경, 카드 배경                                              |
| Text Primary   | `--color-text-primary`   | `#0F172A` | —           | 본문 텍스트                                                       |
| Text Secondary | `--color-text-secondary` | `#475569` | —           | 보조 설명 텍스트                                                  |

> **컬러 역할 원칙**: 오렌지 계열(`--color-paylens-accent`, `--color-data-soft`)은 데이터/수치 표시 전용. 틸(`--color-action`)은 클릭 가능한 인터랙션 전용. 두 역할을 혼용하지 않는다.
>
> ⚠️ `--color-paylens-accent`(`#EE6C4D`)는 원래 CTA 버튼 용도로 설계되었으나, 컬러 시스템 고도화로 **데이터 강조 전용**으로 역할이 변경됨. CTA 버튼은 반드시 `--color-action` 사용.

## 4. 타이포그래피

- **국문/영문 기본 폰트**: Pretendard 또는 Noto Sans KR
- **숫자/데이터 폰트**: JetBrains Mono (Data Sans Mono 대체) — 통계 수치 정렬용

| 클래스명    | 굵기/크기           | Line Height | 적용 대상                        |
| ----------- | ------------------- | ----------- | -------------------------------- |
| Heading 1   | Bold(700) / 24pt    | 1.3         | 랜딩 메인 카피, 대시보드 대제목  |
| Heading 2   | Bold(700) / 16pt    | 1.4         | 섹션 타이틀, 카드 제목           |
| Body Text   | Regular(400) / 10pt | 1.6         | 본문 설명, 리스트 텍스트         |
| Data Number | Medium(500) / 11pt  | 1.2         | 지출 금액, 통계 수치 (Mono 필수) |

## 5. 대시보드 컴포넌트 구조

1. **Total Balance Card**: 총 잔액 상단 굵게 표시 + `Explore >` 드롭다운/이동 버튼
2. **Expense Analysis (도넛 차트)**: Food / Transport / Utilities / Leisure / Savings 카테고리별 색상 구분 + 우측 세로 범례
3. **Spending Trend (라인 차트)**: 월별 지출 추이, Gold Accent + Navy 조합으로 상승/하락 표현
4. **Recent Transactions**: `아이콘 + 거래처명 + 상대 시간(예: 10 mins ago) + 금액` 형식, 마이너스 금액은 `-` 부호 명시

## 6. CSS 변수 (기준 코드)

```css
:root {
  /* Brand Colors */
  --color-paylens-main: #0b2545;
  --color-paylens-sub: #134074;
  --color-paylens-accent: #ee6c4d; /* 데이터 강조 전용 (지출 경고, 차트, 마이너스 금액) */
  --color-data-soft: #ea580c; /* 보조 데이터 (중립 배지, 잔여 바, 결제수단 태그) */
  --color-action: #0d9488; /* UI 액션 전용 (CTA 버튼, 링크, 활성 탭) */
  --color-paylens-bg: #f8fafc;
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;

  /* Typography */
  --font-main: "Pretendard", sans-serif;
  --font-data: "JetBrains Mono", monospace;

  /* Layout */
  --card-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
  --border-radius-m: 12px;
}
```

## 7. 향후 서브 앱(billLens) 확장 고려사항

- Recent Transactions의 `Utility Bill` 항목 우측에 billLens 바로가기 숏컷 아이콘 배치
- billLens OCR 스캔 완료 시 총합 데이터가 payLens `Utilities` 카테고리로 자동 갱신 (공통 API 모듈 `packages/api` 규격 일관 적용)

## 7-1. 로고 에셋 (참고용 / Reference Only)

> ⚠️ 아래 이미지는 AI 생성 시안에서 크롭한 **래스터 참고 이미지**입니다. 해상도가 낮아 그대로 프로덕션에 쓰기엔 무리가 있으며, **벡터(SVG) 재제작이 필요**합니다.

| 파일                                       | 용도                               | 비고                          |
| ------------------------------------------ | ---------------------------------- | ----------------------------- |
| `assets/reference/logo_full.png`           | 풀 로고 (심볼+워드마크+서브타이틀) | 랜딩페이지, 인쇄물용 레퍼런스 |
| `assets/reference/logo_icon_only.png`      | 아이콘 온리 (네이비 사각 배지)     | 앱 아이콘/파비콘 레퍼런스     |
| `assets/reference/logo_horizontal.png`     | 가로형 로고 (심볼+워드마크)        | 헤더/내비게이션 바 레퍼런스   |
| `assets/reference/design_concept_full.png` | 전체 시안 원본                     | 컬러/UI 컴포넌트 통합 참고용  |

**개발 진행 권장 순서**

1. 위 레퍼런스를 디자이너 또는 벡터화 도구(Illustrator 트레이싱, Recraft, Vectorizer.ai 등)에 전달해 SVG 로고 제작
2. 완성된 SVG는 `assets/logo/` (별도 프로덕션 폴더)에 추가하고 본 문서에 경로 업데이트
3. 코드에서는 항상 `assets/logo/`의 SVG를 참조 (래스터 레퍼런스는 디자인 논의용으로만 사용)

## 8. 타겟 유저

- Young Professionals
- Financial Minded Users

---

_원본: `paylens_design_guide.pdf` v1.0 + 시안 이미지(`Gemini_Generated_Image_7mjhu07mjhu07mjh.png`)_
