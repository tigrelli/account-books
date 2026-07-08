#!/usr/bin/env node
/**
 * T-코드 TASK 완료 시 Google Sheets에 테스트 시나리오를 동기화합니다.
 *
 * 사전 조건:
 *   1. Google Cloud 서비스 계정 JSON 키 파일 (아래 SETUP.md 참고)
 *   2. 환경변수 설정 (.env.local 또는 터미널 export)
 *
 * 실행:
 *   node scripts/sync-test-sheet.mjs
 *
 * @typedef {{ no: number; category: string; scenario: string; input: string; expected: string; }} UnitCase
 * @typedef {{ no: number; category: string; scenario: string; precondition: string; path: string; expected: string; }} E2ECase
 * @typedef {{ taskId: string; title: string; unit: UnitCase[]; e2e: E2ECase[]; }} TaskTestData
 */

import { google } from "googleapis";
import { readdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 인증 ──────────────────────────────────────────────────────────────────────
const KEY_FILE =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ??
  path.join(__dirname, ".service-account.json");

if (!existsSync(KEY_FILE)) {
  console.error(`오류: 서비스 계정 키 파일을 찾을 수 없습니다.`);
  console.error(`  경로: ${KEY_FILE}`);
  console.error(
    `  docs/GOOGLE_SHEETS_SETUP.md 를 참고하여 키 파일을 생성하세요.`,
  );
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ],
});

const sheetsApi = google.sheets({ version: "v4", auth });
const driveApi = google.drive({ version: "v3", auth });

const SPREADSHEET_TITLE = "payLens 테스트 시나리오 마스터";
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID ?? null;
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? null;

// ── 색상 (hex → Sheets RGB) ───────────────────────────────────────────────────
const rgb = (hex) => ({
  red: parseInt(hex.slice(1, 3), 16) / 255,
  green: parseInt(hex.slice(3, 5), 16) / 255,
  blue: parseInt(hex.slice(5, 7), 16) / 255,
});

const C = {
  navyMain: rgb("#0B2545"),
  navySub: rgb("#134074"),
  white: { red: 1, green: 1, blue: 1 },
  bgLight: rgb("#F8FAFC"),
  textSec: rgb("#475569"),
};

// ── 서식 요청 헬퍼 ─────────────────────────────────────────────────────────────
const sectionFmt = (sheetId, rowIdx, numCols) => ({
  repeatCell: {
    range: {
      sheetId,
      startRowIndex: rowIdx,
      endRowIndex: rowIdx + 1,
      startColumnIndex: 0,
      endColumnIndex: numCols,
    },
    cell: {
      userEnteredFormat: {
        backgroundColor: C.navySub,
        textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 },
        verticalAlignment: "MIDDLE",
        wrapStrategy: "WRAP",
      },
    },
    fields:
      "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)",
  },
});

const headerFmt = (sheetId, rowIdx, numCols) => ({
  repeatCell: {
    range: {
      sheetId,
      startRowIndex: rowIdx,
      endRowIndex: rowIdx + 1,
      startColumnIndex: 0,
      endColumnIndex: numCols,
    },
    cell: {
      userEnteredFormat: {
        backgroundColor: C.navyMain,
        textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 },
        horizontalAlignment: "CENTER",
        verticalAlignment: "MIDDLE",
        wrapStrategy: "WRAP",
      },
    },
    fields:
      "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
  },
});

const colWidth = (sheetId, colIdx, px) => ({
  updateDimensionProperties: {
    range: {
      sheetId,
      dimension: "COLUMNS",
      startIndex: colIdx,
      endIndex: colIdx + 1,
    },
    properties: { pixelSize: px },
    fields: "pixelSize",
  },
});

const rowHeight = (sheetId, startRow, endRow, px) => ({
  updateDimensionProperties: {
    range: {
      sheetId,
      dimension: "ROWS",
      startIndex: startRow,
      endIndex: endRow,
    },
    properties: { pixelSize: px },
    fields: "pixelSize",
  },
});

const freezeRows = (sheetId, count) => ({
  updateSheetProperties: {
    properties: { sheetId, gridProperties: { frozenRowCount: count } },
    fields: "gridProperties.frozenRowCount",
  },
});

// ── 스프레드시트 ID 확인 ───────────────────────────────────────────────────────
// 서비스 계정은 Drive 저장소 할당량이 없으므로 직접 생성 불가.
// 사용자가 시트를 수동 생성 후 서비스 계정에 공유하고 GOOGLE_SPREADSHEET_ID를 설정해야 함.
async function getSpreadsheetId() {
  if (!SPREADSHEET_ID) {
    console.error(
      "오류: GOOGLE_SPREADSHEET_ID 환경변수가 설정되지 않았습니다.",
    );
    console.error("  1. sheets.new 에서 새 Google 시트 생성");
    console.error(
      `  2. 시트 공유 → playlens-shhet-sync@paylens-500808.iam.gserviceaccount.com (편집자)`,
    );
    console.error(
      "  3. URL에서 시트 ID 복사 후 .env.local 에 GOOGLE_SPREADSHEET_ID=... 설정",
    );
    process.exit(1);
  }
  console.log(
    `시트 사용: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
  );
  return SPREADSHEET_ID;
}

// ── 시트 ID 찾기/생성 ──────────────────────────────────────────────────────────
async function getOrAddSheet(spreadsheetId, title) {
  const { data } = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const existing = data.sheets.find((s) => s.properties.title === title);
  if (existing) return existing.properties.sheetId;

  const { data: updated } = await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  return updated.replies[0].addSheet.properties.sheetId;
}

// ── 표지 시트 ─────────────────────────────────────────────────────────────────
async function syncCoverSheet(spreadsheetId, taskIds) {
  const sheetId = await getOrAddSheet(spreadsheetId, "표지");
  const today = new Date().toLocaleDateString("ko-KR");

  const rows = [
    [],
    ["payLens"],
    [],
    ["테스트 시나리오 마스터"],
    [],
    [`작성일: ${today}`],
    [`포함된 TASK: ${taskIds.length}개`],
    [],
    ["포함 TASK 목록"],
    ...taskIds.map((id, i) => [`  ${i + 1}. ${id}`]),
    [],
    ["Trusted Expense Analysis"],
  ];

  await sheetsApi.spreadsheets.values.clear({
    spreadsheetId,
    range: "표지!A1:Z100",
  });
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: "표지!A1",
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  // 제목 행 서식
  const requests = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2 },
        cell: {
          userEnteredFormat: {
            textFormat: {
              bold: true,
              fontSize: 24,
              foregroundColor: C.navyMain,
            },
          },
        },
        fields: "userEnteredFormat.textFormat",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 3, endRowIndex: 4 },
        cell: {
          userEnteredFormat: {
            textFormat: {
              bold: true,
              fontSize: 16,
              foregroundColor: C.navySub,
            },
          },
        },
        fields: "userEnteredFormat.textFormat",
      },
    },
    colWidth(sheetId, 0, 320),
  ];
  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  console.log("✓ 표지 업데이트 완료");
}

// ── T-코드 시트 ───────────────────────────────────────────────────────────────
/** @param {string} spreadsheetId @param {TaskTestData} taskData */
async function syncTaskSheet(spreadsheetId, taskData) {
  const { taskId, title, unit, e2e } = taskData;
  const sheetId = await getOrAddSheet(spreadsheetId, taskId);

  // ── 행 데이터 조립 ───────────────────────────────────────
  const rows = [];
  const UNIT_COLS = 8;
  const E2E_COLS = 9;

  // 단위 테스트
  const unitSectionRow = rows.length;
  rows.push([`[단위 테스트]  ${title}`, "", "", "", "", "", "", ""]);

  const unitHeaderRow = rows.length;
  rows.push([
    "No.",
    "분류",
    "테스트 항목",
    "입력/조건",
    "기댓값",
    "확인",
    "결과",
    "비고",
  ]);

  unit.forEach(({ no, category, scenario, input, expected }) => {
    rows.push([no, category, scenario, input, expected, "□", "", ""]);
  });

  rows.push(["", "", "", "", "", "", "", ""]); // spacer

  // E2E 테스트
  const e2eSectionRow = rows.length;
  rows.push([`[E2E 테스트]  ${title}`, "", "", "", "", "", "", "", ""]);

  const e2eHeaderRow = rows.length;
  rows.push([
    "No.",
    "분류",
    "테스트 항목",
    "사전 조건",
    "경로",
    "기댓값",
    "확인",
    "결과",
    "비고",
  ]);

  e2e.forEach(
    ({ no, category, scenario, precondition, path: testPath, expected }) => {
      rows.push([
        no,
        category,
        scenario,
        precondition,
        testPath,
        expected,
        "□",
        "",
        "",
      ]);
    },
  );

  rows.push([]);
  rows.push([`작성일: ${new Date().toLocaleDateString("ko-KR")}`]);

  // ── 시트에 쓰기 ──────────────────────────────────────────
  await sheetsApi.spreadsheets.values.clear({
    spreadsheetId,
    range: `${taskId}!A1:Z1000`,
  });
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: `${taskId}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  // ── 서식 적용 ─────────────────────────────────────────────
  const requests = [
    freezeRows(sheetId, 2),
    sectionFmt(sheetId, unitSectionRow, UNIT_COLS),
    headerFmt(sheetId, unitHeaderRow, UNIT_COLS),
    sectionFmt(sheetId, e2eSectionRow, E2E_COLS),
    headerFmt(sheetId, e2eHeaderRow, E2E_COLS),

    // 단위 테스트 열 너비
    colWidth(sheetId, 0, 48), // No.
    colWidth(sheetId, 1, 110), // 분류
    colWidth(sheetId, 2, 200), // 테스트 항목
    colWidth(sheetId, 3, 220), // 입력/조건
    colWidth(sheetId, 4, 220), // 기댓값
    colWidth(sheetId, 5, 48), // 확인
    colWidth(sheetId, 6, 70), // 결과
    colWidth(sheetId, 7, 130), // 비고
    colWidth(sheetId, 8, 130), // 비고 (E2E 9열)

    // 행 높이
    rowHeight(sheetId, unitSectionRow, unitSectionRow + 1, 32),
    rowHeight(sheetId, unitHeaderRow, unitHeaderRow + 1, 28),
    rowHeight(sheetId, e2eSectionRow, e2eSectionRow + 1, 32),
    rowHeight(sheetId, e2eHeaderRow, e2eHeaderRow + 1, 28),
  ];

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  console.log(
    `✓ ${taskId} (단위 ${unit.length}건 / E2E ${e2e.length}건) 동기화 완료`,
  );
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  const dataDir = path.join(__dirname, "test-data");
  const files = (await readdir(dataDir))
    .filter((f) => f.endsWith(".mjs"))
    .sort();

  if (files.length === 0) {
    console.error("오류: scripts/test-data/ 에 테스트 데이터 파일이 없습니다.");
    process.exit(1);
  }

  console.log(`데이터 파일 ${files.length}개 발견:`, files.join(", "));

  const allData = /** @type {TaskTestData[]} */ (
    await Promise.all(
      files.map((f) =>
        import(pathToFileURL(path.join(dataDir, f))).then((m) => m.default),
      ),
    )
  );

  const spreadsheetId = await getSpreadsheetId();

  await syncCoverSheet(
    spreadsheetId,
    allData.map((d) => d.taskId),
  );
  for (const taskData of allData) {
    await syncTaskSheet(spreadsheetId, taskData);
  }

  console.log(`\n완료 ✓`);
  console.log(
    `시트 URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  );
}

main().catch((err) => {
  console.error("\n오류 발생:", err.message);
  if (
    err.message.includes("invalid_grant") ||
    err.message.includes("credentials")
  ) {
    console.error(
      "서비스 계정 키 파일을 확인하세요: docs/GOOGLE_SHEETS_SETUP.md",
    );
  }
  process.exit(1);
});
