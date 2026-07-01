# CLAUDE.md

이 문서는 Claude Code가 이 저장소에서 작업할 때마다 **자동으로, 매번** 읽는 가이드입니다. 그래서 이 문서는 의도적으로 짧게 유지합니다 — 매 세션 고정 비용으로 들어가기 때문에, 자세한 내용은 여기 두지 않고 필요할 때만 원본 문서에서 발췌해서 보는 구조로 설계했습니다(아래 "효율적으로 참조하는 법" 참고).

## 프로젝트 개요

지출 관리에 특화된 가계부 앱. 메인 가계부(Core)에 관리비/구독료/카드내역 등 서브앱이 Webhook으로 연동되는 구조. 웹/모바일 반응형, 항목별·지출처별·상세품목별 통계/대시보드가 핵심 기능.

**개발 방식**: PM 1인 + Claude Code 바이브 코딩. 코드 리뷰는 PM이 직접 수행하므로, 매 TASK마다 변경 범위를 작게 유지하고 설명을 명확히 할 것.

## 필수 참조 문서 (전체를 매번 읽지 말 것 — 아래 "효율적으로 참조하는 법" 참고)

이 6개 문서가 이 프로젝트의 단일 진실 공급원(Source of Truth)입니다. 단, **이미 핵심 결정사항은 이 CLAUDE.md 안에 요약되어 있으므로, 대부분의 TASK는 이 파일만 보고 진행 가능**합니다. 원본 문서는 "이 파일에 없는 세부사항"이 필요할 때만 찾아봅니다.

| 문서                               | 용도                                                                                                                                                                | 크기                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `docs/가계부_아키텍처_설계.md`     | 전체 아키텍처, ERD, 인증/배포 설계. **장 번호(1, 1-1①~⑥, 2~8)** 기준으로 구성됨                                                                                     | 약 800줄 — 통째로 읽지 말 것 |
| `docs/기능명세서_IA.md`            | 화면/기능 명세. **F-코드**로 기능 식별 (예: F-1-1-4 = 지출 입력)                                                                                                    | 약 150줄 — 전체 읽어도 무방  |
| `docs/WBS.md`                      | 작업 분해 구조(계획). **S-코드**(시스템/인프라)와 F-코드(앱 기능), TASK ID. **이 파일은 진행 중에 수정하지 않음**                                                   | 약 250줄                     |
| `docs/진행현황.md`                 | **진행 상태(체크리스트)**. WBS의 TASK ID별 `[ ]`/`[x]` 체크박스만 있음. TASK 완료마다 갱신되는 파일은 이거 하나뿐                                                   | 약 180줄, TASK당 한 줄       |
| `docs/데이터정책_및_시드정의서.md` | 시드 데이터(기본 카테고리/단위/결제수단), 비즈니스 규칙(삭제/검증 정책), RLS 정책 표. **`S-1-1`~`S-1-9` 작업 시 그대로 옮겨 적는 원본**                             | 약 100줄 — 전체 읽어도 무방  |
| `docs/DESIGN_GUIDE.md`             | **UI 작업 시 참조**. 브랜드 컬러 토큰, 타이포그래피, 컴포넌트 구조, CSS 변수 기준 코드. 아래 "디자인 시스템 핵심" 섹션에 요약됨 — 세부 스펙이 필요할 때만 원본 열기 | 약 100줄 — 전체 읽어도 무방  |
| `CLAUDE.md` (이 문서)              | 코딩 컨벤션/제약 — **여기부터 확인**                                                                                                                                | -                            |

### 효율적으로 참조하는 법 (토큰 절약)

1. **TASK를 시작하기 전엔 WBS.md에서 그 TASK 한 줄(행)만 확인** — WBS 전체를 다시 읽지 말고, `grep "S-1-6" docs/WBS.md` 처럼 해당 TASK ID 줄만 찾아서 본다.
2. **아키텍처 설계서는 "장 번호"로 그 섹션만 추출해서 본다** — 예: ERD가 필요하면 `grep -n "## 4. 데이터 모델" docs/가계부_아키텍처_설계.md` 로 줄 번호를 찾고, 그 장(다음 `## ` 헤더 전까지)만 읽는다. 파일 전체를 열지 않는다.
3. **같은 영역의 TASK를 연속으로 진행할 때는 재조회하지 않는다** — 예: F-1-5-1~F-1-5-14처럼 "지출 입력" 블록을 연달아 진행할 때는 1-1③④ 섹션을 처음 한 번만 읽고, 같은 세션/연속 작업 동안은 다시 읽지 않는다.
4. **ERD/스키마처럼 자주 참조하는 내용은 코드에 이미 반영돼 있다** — `packages/types/database.generated.ts`(Supabase가 생성한 타입)나 기존 마이그레이션 파일을 먼저 보는 게, 설계서 4장 ERD를 다시 읽는 것보다 빠르고 정확하다(실제 스키마 = 진실).
5. **새로운 영역(예: Phase 1→Phase 2로 넘어갈 때)에 처음 진입할 때만** 해당 장 전체를 한 번 읽는다. 같은 영역 안에서 TASK가 바뀔 때마다 매번 다시 읽지 않는다.

**작업 규칙**: TASK ID를 받으면 ① 위 방식대로 WBS에서 해당 행만 확인 → ② 처음 보는 영역이면 그 장만 발췌해서 확인 → ③ 구현. 설계서와 다르게 구현해야 할 이유가 있으면 임의로 바꾸지 말고 먼저 PM에게 확인을 요청할 것.

## 기술 스택 (아키텍처 설계서 8장 기준, 임의 변경 금지)

- **Front-end**: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **상태/데이터**: TanStack Query + `@supabase/ssr`, `@supabase/supabase-js`
- **차트**: Recharts
- **DB/Auth/Storage**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **Backend(경량)**: Supabase Edge Functions (Deno/TypeScript)
- **Backend(복잡 로직, 필요시)**: Node.js + NestJS — 1단계에서는 만들지 않음, 필요해질 때만 생성
- **모노레포**: pnpm workspace + Turborepo
- **CI/CD**: GitHub Actions + Supabase GitHub 연동(DB 마이그레이션) + 별도 프론트 배포(Vercel 등, 8-3-1 참고)

## 모노레포 구조 (아키텍처 설계서 2장과 동일하게 유지)

```
account-books/
├── apps/
│   ├── main/{web,server}
│   └── sub-apps/{utility-bill,subscription,card-statement}
├── packages/
│   ├── ui/ types/ event-contracts/ supabase-client/ config/ utils/
├── supabase/
│   ├── config.toml  migrations/  functions/  seed.sql
├── .github/workflows/
├── docs/                  ← 위 4개 참조 문서를 여기에 둠
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

새 폴더/패키지를 추가해야 할 때는 이 구조를 벗어나지 말고, 벗어나야 한다면 먼저 이유를 설명하고 확인받을 것.

## Supabase / DB 작업 규칙

- **마이그레이션은 항상 `supabase migration new <설명>`으로 생성**하고 `supabase/migrations/`에 SQL로 남길 것. 대시보드에서 직접 스키마를 바꾸지 않음(로컬 변경 → 마이그레이션 파일 → push 순서 고정).
- **RLS는 모든 사용자 데이터 테이블에서 기본 활성화**. 임시 디버깅 목적이라도 RLS를 끄는 마이그레이션을 작성하지 말 것.
- 테이블/컬럼 명명: `snake_case`. 코드 단에서는 `supabase gen types typescript`로 생성된 타입을 그대로 사용(직접 타입을 손으로 다시 안 만듦).
- 시드 데이터(시스템 기본 카테고리, 기본 단위, 현금 PAYMENT_METHOD 등)는 `supabase/seed.sql`에 작성.
- 마이그레이션 작성 후에는 반드시 `supabase db reset` (로컬) 또는 `supabase db push --dry-run`으로 검증.
- **새 테이블 생성 시 RLS 정책만으로는 부족 — `authenticated`(필요시 `anon`) 롤에 대한 명시적 `GRANT`(SELECT/INSERT/UPDATE/DELETE)를 반드시 함께 작성할 것.** `config.toml`의 `auto_expose_new_tables`가 기본 비활성화라 예전처럼 테이블 생성 시 자동으로 권한이 부여되지 않는다. PostgreSQL은 RLS보다 테이블 GRANT를 먼저 검사하므로, GRANT 누락 시 RLS 정책이 맞아도 `42501 permission denied`로 조용히 막힌다(S-1-1~S-1-8에서 실제로 발생 — `20260701100604_grant_authenticated_table_privileges.sql` 참고). RLS 정책과 정확히 같은 범위(테이블별 정책 있는 동작만)로 GRANT할 것 — 정책 없는 동작(예: DELETE 정책 미생성 테이블)에는 GRANT도 부여하지 않는다.
- Service Role Key는 **서버/Edge Function에서만** 사용. 클라이언트(브라우저) 코드에 절대 노출 금지.

## 디자인 시스템 핵심 (UI 작업 시 참고)

> 세부 스펙은 `docs/DESIGN_GUIDE.md` 참조. 아래는 매 세션 기억해야 할 최소 기준값.

- **브랜드 아이덴티티**: Refined Navy with Gold Accent. 앱명 `payLens` (L 대문자).
- **CSS 변수 — 반드시 하드코딩 HEX 대신 변수명 사용**:
  | 변수명 | HEX | 주 용도 |
  |---|---|---|
  | `--color-paylens-main` | `#0B2545` | 헤더, 주 타이포, 로고 배경 |
  | `--color-paylens-sub` | `#134074` | 활성 메뉴탭, 컴포넌트 테두리 |
  | `--color-paylens-accent` | `#EE6C4D` | **데이터 강조 전용** — 지출 경고, 트렌드 차트, 마이너스 금액 |
  | `--color-data-soft` | `#EA580C` | **보조 데이터** — 중립 배지(▼), 잔여 예산 바, 결제수단 태그 |
  | `--color-action` | `#0D9488` | **UI 액션 전용** — CTA 버튼, 링크, 사이드바 활성 탭 |
  | `--color-paylens-bg` | `#F8FAFC` | 전체/카드 배경 |
  | `--color-text-primary` | `#0F172A` | 본문 텍스트 |
  | `--color-text-secondary` | `#475569` | 보조 설명 텍스트 |
- **폰트**: 본문/UI → `Pretendard` (fallback: Noto Sans KR). 금액·통계 수치 → `JetBrains Mono` (`--font-data`).
- **로고 에셋**: 현재 `docs/reference/` 하위 래스터 PNG는 참고용. 프로덕션 코드에서는 벡터(SVG) 재제작 후 `assets/logo/`를 참조할 것 — SVG 미완성 상태에서 래스터를 그대로 코드에 넣지 말 것.
- **카드 스타일**: `box-shadow: var(--card-shadow)`, `border-radius: var(--border-radius-m)` (12px) 기본값.

## 코딩 컨벤션

- 언어: TypeScript strict 모드. `any` 사용 금지(불가피한 경우 주석으로 이유 명시).
- 컴포넌트/파일명: React 컴포넌트는 `PascalCase.tsx`, 유틸/훅은 `camelCase.ts`.
- 공통 타입/스키마는 새로 만들기 전에 `packages/types`, `packages/event-contracts`에 이미 있는지 먼저 확인.
- 폼 검증: zod 사용. API 요청/응답도 zod로 파싱.
- **`useActionState` 폼의 입력 필드 상태 관리**: React는 `<form action={함수}>` 제출 후 비제어(uncontrolled) 입력을 자동으로 리셋한다(네이티브 폼 제출과 동일 동작 모방). 검증 실패 시에도 사용자가 다시 입력할 필요 없이 값이 남아있어야 하는 필드(이름/이메일/텍스트 입력 등)는 `useState`로 제어 컴포넌트화해서 값을 보존할 것. 비밀번호류 민감 필드는 의도적으로 비제어 상태로 두어 제출마다 리셋되게 한다(보안/UX 관례). 새로 만드는 모든 입력 폼(지출 입력, 마스터 데이터 CRUD 등)에 이 패턴을 기본 적용할 것.
  - 액션이 반환하는 성공 상태는 반드시 `{ status: "idle" }`이 아니라 `{ status: "success" }`(또는 그에 준하는 구분 가능한 값)로 리턴할 것 — "idle"을 그대로 재사용하면 초기 상태와 구분이 안 돼 "성공 시 폼 닫기/입력값 비우기" 로직이 동작하지 않는다.
  - "제출 성공 시 편집모드 닫기/입력값 비우기" 처리는 `useEffect`로 하지 말고(캐스케이드 렌더링 경고 발생) 렌더 중 이전 값과 비교하는 React 공식 패턴을 쓸 것. 이때 비교 대상은 `state.status`가 아니라 **`state` 객체 참조 자체**여야 한다 — `status` 문자열만 비교하면 연속으로 같은 상태(예: 성공→성공)가 반환될 때 변화가 감지되지 않는다:
    ```tsx
    const [prevState, setPrevState] = useState(state);
    if (state !== prevState) {
      setPrevState(state);
      if (state.status === "success") {
        /* 편집모드 닫기 등 */
      }
    }
    ```
- 주석은 "왜"를 설명하는 경우에만 작성, 코드가 "무엇"을 하는지는 코드 자체로 읽히게 작성.
- 커밋 메시지 형식: `[TASK-ID] 작업 내용` (예: `[F-1-5-4] 상세항목 추가 UI 동적 행 구현`) — WBS의 TASK ID를 그대로 사용해 추후 추적 가능하게 할 것.
- **Lint/Format은 직접 설정을 건드리지 말고 기존 룰을 따른다.** 설정은 `packages/config`(ESLint/Prettier 공유 설정)에 정의되어 있고(S-0-14), 각 앱은 그걸 extends만 함. 코드 작성 후 `pnpm lint`, `pnpm format`으로 확인할 것 — 규칙을 바꿔야 할 이유가 있으면 먼저 PM에게 확인.
- **커밋 시 Husky pre-commit 훅이 자동으로 lint-staged(lint+format)를 실행**하고(S-0-15), push 전 pre-push 훅에서 typecheck가 돈다. 훅이 실패하면 코드를 고치고, 훅 자체를 건너뛰거나(`--no-verify`) 비활성화하지 말 것.
- **커밋 메시지는 commitlint로 형식이 강제됨**(S-0-22) — `[TASK-ID] 작업 내용` 형식을 안 지키면 커밋 자체가 막힌다. 형식을 우회하지 말고 맞춰 쓸 것.
- **테스트는 Vitest(단위) + Playwright(E2E)로 고정**(S-0-21) — `pnpm test`, `pnpm test:e2e`로 실행. WBS의 T-코드 TASK는 이 두 도구로 작성.
- **환경변수**: `.env.example`에 키 목록만 정의하고 실제 값은 절대 커밋하지 않음. 로컬은 `.env.local`, CI/배포는 GitHub Secrets / 호스팅 플랫폼의 환경변수 설정 사용(S-0-16). `NEXT_PUBLIC_` 접두사가 붙은 변수만 브라우저에 노출되니, Service Role Key 등 민감한 키에는 절대 붙이지 말 것.
- **`main` 브랜치는 직접 push 금지** — 브랜치 보호 규칙(S-0-23)으로 PR + CI 통과가 강제됨. 급한 수정이라도 `hotfix/*` 브랜치 + PR로 진행.

## 작업 진행 방식 (PM 1인 + Claude Code)

1. 매 세션 시작 시 PM이 진행할 TASK ID를 지정하면, **`docs/진행현황.md`에서 그 TASK가 아직 미완료(`[ ]`)인지, 선행작업이 완료(`[x]`)됐는지 확인**할 것(WBS.md를 다시 열 필요 없이 진행현황.md만 grep해도 충분). 선행작업이 안 끝났으면 먼저 알릴 것.
2. **TASK 하나를 끝내면 자체적으로 다음 TASK로 넘어가지 말고 멈춰서 PM에게 결과를 보여줄 것** — 한 세션에 여러 TASK를 욕심내어 한꺼번에 처리하지 않는다(WBS의 세션 추정이 TASK 단위 분해를 전제로 하기 때문).
3. **PM이 완료를 확인("완료", "다음 TASK 진행" 등)하면, 그 시점에만 `docs/진행현황.md`에서 해당 TASK의 체크박스를 `[ ]` → `[x]`로 바꿀 것.** 스스로 판단해서 미리 체크하지 않는다. WBS.md(계획 문서)는 진행 중에 절대 수정하지 않는다 — 계획과 진행상황을 분리 유지.
4. 테스트(T-코드)가 있는 TASK는 구현과 같은 세션에서 끝내는 것을 우선 시도. 시간이 부족하면 "구현 완료, 테스트는 다음 TASK로 분리 필요"를 명확히 보고할 것.
5. **T-코드 TASK 완료 시 아래 3가지를 반드시 수행할 것**:
   1. `docs/test-scenarios.md` 에 해당 섹션 누적 기록 (테스트 파일의 `describe`/`test` 이름 기준, 표 형식)
   2. `account-books/scripts/test-data/{TASK-ID}.mjs` 파일 생성 — `T-1-3-1.mjs` 구조 그대로 따를 것
   3. PM에게 Google Sheets 동기화 스크립트 실행을 안내: `cd account-books/scripts && node sync-test-sheet.mjs`
   - 설정 방법: `docs/GOOGLE_SHEETS_SETUP.md` 참고. 스크립트가 "payLens 테스트 시나리오 마스터" 시트를 자동 생성/갱신함.
6. 설계서(아키텍처/IA/WBS)와 실제 구현이 달라져야 할 필요가 생기면, 코드만 고치고 끝내지 말고 **어느 문서를 어떻게 고쳐야 하는지 같이 알려줄 것** (특히 ERD나 F-코드가 바뀌는 경우).

## 하지 말아야 할 것

- Event Bus(Kafka 등) 도입 — 1~4단계까지는 보류 확정(아키텍처 1장 참고). 서브앱 연동은 Webhook으로만 구현.
- 자체 Auth 서버 구축 — Supabase Auth만 사용(아키텍처 3장).
- `packages/api-client`, `packages/auth-client` 같은 이미 폐기된 패키지명 재생성 — 대신 `packages/supabase-client` 사용.
- 마이그레이션 없이 Supabase 대시보드에서 직접 테이블/컬럼 수정.
- 임의로 새로운 npm 패키지/라이브러리 추가 — 기존 스택(Recharts, TanStack Query, shadcn/ui 등)으로 해결이 안 될 때만 제안하고 PM 확인 후 추가.

## 현재 진행 단계

**현재 Phase: Phase 0 — 사전 셋업** (PM이 다음 Phase로 넘어갈 때 이 줄만 직접 고쳐서 갱신함 — Claude Code가 스스로 바꾸지 않음)

다음에 진행할 TASK는 `docs/진행현황.md`에서 **체크 안 된(`[ ]`) 항목 중 Phase 0 섹션의 가장 위에 있는 것**부터 순서대로. Phase 0이 전부 끝나기 전에는 Phase 1(DB 테이블, S-1-x)이나 화면(F-코드) 작업을 시작하지 말 것 — 순서가 바뀌면 재작업 위험이 커짐(WBS 9장 작업순서 원칙 참고).
