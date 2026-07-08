# account-books

지출 관리에 특화된 가계부 모노레포. 메인 앱 **payLens**와 서브 앱(관리비 명세 등)이 Webhook으로 연동되는 구조.

## 앱 구성

| 앱                           | 설명                            | 상태    |
| ---------------------------- | ------------------------------- | ------- |
| `apps/main/web`              | payLens — 메인 가계부 (Next.js) | 개발 중 |
| `apps/sub-apps/utility-bill` | billLens — 관리비 명세 서브앱   | 예정    |

## 기술 스택

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **상태/데이터**: TanStack Query + `@supabase/ssr`
- **DB/Auth**: Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- **모노레포**: pnpm workspace + Turborepo

## 로컬 개발 시작

### 사전 준비

- Node.js 20+
- pnpm 11+
- Docker (Supabase CLI 로컬 실행에 필요)

### 설치

```bash
# 의존성 설치
pnpm install

# 환경변수 설정
cp apps/main/web/.env.example apps/main/web/.env.local
# .env.local 파일을 열어 Supabase URL과 키 입력
```

### 개발 서버 실행

```bash
# 전체 앱 동시 실행
pnpm dev

# payLens만 실행
pnpm --filter @account-books/web dev
```

### Supabase 로컬 실행 (선택)

```bash
# Docker가 실행 중이어야 함
pnpm supabase start

# 마이그레이션 적용
pnpm supabase db reset
```

로컬 Docker Supabase로 개발/테스트하려면 `apps/main/web/.env.development.local` 파일에 `npx supabase status -o env`로 확인한 로컬 값(`API_URL`→`NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY`→`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SERVICE_ROLE_KEY`→`SUPABASE_SERVICE_ROLE_KEY`)을 넣어두면 된다. Next.js가 `next dev` 실행 시 이 파일을 `.env.local`보다 우선 적용하므로 별도 전환 작업 없이 항상 로컬 DB를 바라본다(클라우드로 테스트하려면 이 파일을 잠시 다른 이름으로 옮겨두면 `.env.local`의 클라우드 값이 적용됨). 이 파일은 `.env.*.local` 패턴으로 커밋에서 제외된다.

## 주요 스크립트

```bash
pnpm build       # 전체 빌드
pnpm lint        # ESLint 검사
pnpm format      # Prettier 포맷
pnpm typecheck   # TypeScript 타입 검사
pnpm test        # Vitest 단위 테스트
pnpm test:e2e    # Playwright E2E 테스트
```

## 디렉토리 구조

```
account-books/
├── apps/
│   ├── main/web/                  # payLens (Next.js App Router)
│   └── sub-apps/utility-bill/     # billLens (예정)
├── packages/
│   ├── config/                    # ESLint/Prettier/tsconfig 공유 설정
│   ├── types/                     # 공통 TypeScript 타입 + DB 생성 타입
│   ├── utils/                     # 공통 유틸 함수 (formatCurrency 등)
│   ├── ui/                        # 공통 UI 컴포넌트 (예정)
│   ├── supabase-client/           # Supabase 클라이언트 초기화 (browser/server/middleware)
│   └── event-contracts/           # 서브앱 Webhook 이벤트 스키마 (zod)
├── supabase/
│   ├── migrations/                # DB 마이그레이션 SQL
│   ├── functions/                 # Edge Functions
│   └── seed.sql                   # 시드 데이터
├── .github/workflows/             # CI/CD (ci.yml, deploy-migrations.yml, deploy-functions.yml)
└── docs/                          # 아키텍처/기능 명세/WBS 문서
```

## 환경변수

필요한 환경변수 목록은 `.env.example`을 참고. 로컬 개발은 `apps/main/web/.env.local`에 입력.

| 변수                            | 용도                    | 위치                     |
| ------------------------------- | ----------------------- | ------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 프로젝트 URL   | 브라우저 노출 가능       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key       | 브라우저 노출 가능       |
| `SUPABASE_SERVICE_ROLE_KEY`     | 서버/Edge Function 전용 | **절대 클라이언트 금지** |
| `SUPABASE_ACCESS_TOKEN`         | Supabase CLI 인증       | CI/CD only               |
| `SUPABASE_PROJECT_ID`           | 프로젝트 Reference ID   | CI/CD only               |
| `SUPABASE_DB_PASSWORD`          | DB 비밀번호             | CI/CD only               |

## 브랜치 전략

- `main` — 프로덕션. 직접 push 금지, PR + CI 통과 필수
- `develop` — 기본 작업 브랜치
- `feature/*` — 기능 개발
- `hotfix/*` — 긴급 수정
