# Google Sheets 연동 설정 가이드

테스트 시나리오를 Google Sheets에 자동으로 동기화하기 위한 설정입니다.  
스크립트: `account-books/scripts/sync-test-sheet.mjs`

---

## 1단계: Google Cloud 프로젝트 설정

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 상단 프로젝트 선택 드롭다운 → **새 프로젝트** 클릭
   - 프로젝트 이름: `payLens` (또는 기존 프로젝트 재사용 가능)
3. 생성 후 해당 프로젝트 선택

---

## 2단계: API 활성화

콘솔 좌측 메뉴 → **API 및 서비스** → **라이브러리**

다음 2개 API 검색 후 **사용** 클릭:

- `Google Sheets API`
- `Google Drive API`

---

## 3단계: 서비스 계정 생성

1. **API 및 서비스** → **사용자 인증 정보** → **사용자 인증 정보 만들기** → **서비스 계정**
2. 서비스 계정 이름: `paylens-sheets-sync`
3. 역할: **편집자** (또는 더 제한된 역할로: Drive 파일 > 파일 만들기, Sheets > 수정)
4. **완료** 클릭

---

## 4단계: JSON 키 파일 다운로드

1. 방금 만든 서비스 계정 클릭
2. **키** 탭 → **키 추가** → **새 키 만들기** → **JSON** 선택
3. 다운로드된 JSON 파일을 다음 경로에 저장:
   ```
   account-books/scripts/.service-account.json
   ```
   > 이 파일은 `.gitignore`에 포함되어 있어 커밋되지 않습니다.

---

## 5단계: Google 시트 수동 생성 + 공유

> ⚠️ 서비스 계정은 개인(비-Workspace) GCP 프로젝트에서는 Drive 저장소 할당량이 없어 **파일을 직접 생성할 수 없습니다** — 스크립트가 새 시트를 자동으로 만들어주지 않으니, 아래처럼 사람이 먼저 시트를 만들고 서비스 계정에 공유해야 합니다.

1. [sheets.new](https://sheets.new) 에서 새 Google 시트 생성 (이름 예: `payLens 테스트 시나리오 마스터`)
2. 시트 우측 상단 **공유** 클릭
3. 서비스 계정 이메일 입력 (JSON 파일 내 `client_email` 값, 예: `paylens-sheets-sync@프로젝트ID.iam.gserviceaccount.com`)
4. 권한: **편집자** → **보내기**
5. 시트 URL에서 시트 ID 복사:
   ```
   https://docs.google.com/spreadsheets/d/{시트ID}/edit
   ```

---

## 6단계: 환경변수 설정

> ⚠️ `sync-test-sheet.mjs`는 dotenv를 로드하지 않습니다 — `apps/main/web/.env.local`에 값을 넣어도 `scripts` 폴더에서 스크립트를 단독 실행할 때는 읽히지 않습니다. 아래처럼 **실행할 때마다 터미널에서 직접 지정**하거나 쉘 프로필(`~/.bashrc` 등)에 `export`해두세요.

```bash
export GOOGLE_SERVICE_ACCOUNT_KEY_FILE="/절대경로/account-books/scripts/.service-account.json"
export GOOGLE_SPREADSHEET_ID="5단계에서 복사한 시트 ID"
```

> `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`은 생략 가능 — 미설정 시 스크립트 기본값(`scripts/.service-account.json`)을 사용하므로, 4단계에서 안내한 경로에 파일을 저장했다면 이 값을 굳이 지정하지 않아도 됩니다. `GOOGLE_SPREADSHEET_ID`는 필수이며 미설정 시 스크립트가 바로 종료됩니다.

---

## 7단계: 의존성 설치 및 실행

```bash
# scripts 패키지 의존성 설치 (최초 1회)
cd account-books/scripts
npm install

# 동기화 실행 (6단계 환경변수를 이미 export 했다면 바로 실행)
cd account-books/scripts
node sync-test-sheet.mjs
```

성공 시 출력:

```
데이터 파일 9개 발견: T-1-3-1.mjs, T-1-4-1.mjs, ...
시트 사용: https://docs.google.com/spreadsheets/d/...
✓ 표지 업데이트 완료
✓ T-1-3-1 (단위 13건 / E2E 6건) 동기화 완료

완료 ✓
시트 URL: https://docs.google.com/spreadsheets/d/...
```

---

## 향후 T-코드 TASK 추가 방법

새 T-코드 TASK(예: T-1-4-1) 완료 시:

1. `docs/test-scenarios.md` 에 해당 섹션 추가 (CLAUDE.md 규칙에 따라)
2. `account-books/scripts/test-data/T-1-4-1.mjs` 파일 생성 (T-1-3-1.mjs 참고)
3. 동기화 스크립트 실행:
   ```bash
   cd account-books/scripts && node sync-test-sheet.mjs
   ```
4. Google Sheets에 새 탭이 자동 추가됨

---

## 문제 해결

| 오류                                                   | 원인                                   | 해결                                                          |
| ------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------- |
| `ENOENT: .service-account.json`                        | 키 파일 경로 불일치                    | `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` 환경변수 확인               |
| `GOOGLE_SPREADSHEET_ID 환경변수가 설정되지 않았습니다` | 시트를 아직 만들지 않았거나 env 미설정 | 5단계로 시트 생성 후 6단계대로 `GOOGLE_SPREADSHEET_ID` export |
| `invalid_grant`                                        | 키 파일 내용 오류 또는 만료            | GCP 콘솔에서 새 키 재발급                                     |
| `The caller does not have permission`                  | 서비스 계정이 시트에 공유 안 됨        | 5단계 시트 공유(서비스 계정 이메일, 편집자) 재확인            |
| `API has not been enabled`                             | Sheets/Drive API 미활성화              | 2단계 API 활성화 재확인                                       |
