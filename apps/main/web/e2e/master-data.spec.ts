import { test, expect, type Page, type Locator } from "@playwright/test";

// T-5-1: 마스터데이터 관리 화면(F-1-4-1~3)의 등록→수정→비활성화→활성화 흐름은 스키마 단위테스트만
// 있었고 화면 자체의 e2e 회귀가 없었다 — 전체 기능 회귀테스트 범위에 새로 포함한다.

const testEmail = () =>
  `master_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "마스터데이터테스트";

async function signUpAndLogin(page: Page): Promise<void> {
  await page.goto("/signup");
  await page.fill("#name", testName);
  await page.fill("#email", testEmail());
  await page.fill("#password", testPassword);
  await page.fill("#confirmPassword", testPassword);
  await page.click('button[type="submit"]');
  await expect(page.getByText("이메일을 확인해 주세요")).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL("/");
}

// CategoryRow/VendorRow/AccountRow/CardRow는 모두 "이름 텍스트 + 버튼 그룹"을 함께 담은 행
// 컨테이너(div)를 갖지만 중첩 깊이가 화면마다 달라(카드는 이름/부제목을 한 번 더 감싸는 div가 있음)
// 텍스트 노드에서 고정된 단계만큼 부모로 올라가는 방식은 깨지기 쉽다 — 대신 "그 이름을 포함하면서
// 지정된 버튼도 포함하는 가장 안쪽 div"를 찾는다(문서 순서상 조상보다 후손이 뒤에 오므로 .last()가
// 항상 가장 안쪽/가장 구체적인 행을 가리킨다).
function rowFor(page: Page, scope: Locator, exactName: string, anchorButtonName: string): Locator {
  return scope
    .locator("div")
    .filter({ hasText: exactName })
    .filter({ has: page.getByRole("button", { name: anchorButtonName }) })
    .last();
}

// 수정 모드로 들어가면 그 행은 `<form><input type="hidden" name="id">...</form>`으로 바뀐다 —
// 등록 폼도 같은 필드명(name="name"/"displayName")을 쓰고 있어 이름만으로 찾으면 모호해지므로,
// hidden id 필드가 있는 폼(=수정 폼)으로 먼저 좁힌 뒤 그 안에서 입력창을 찾는다.
function editFormOf(scope: Locator): Locator {
  return scope.locator('form:has(input[name="id"])');
}

test.describe("F-1-4-1 지출분류 관리 — 계좌", () => {
  test("등록 → 수정 → 비활성화 → 활성화", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/payment-methods");
    const section = page.locator("section", { hasText: "계좌" });

    await section.getByPlaceholder("예: 신한은행 통장").fill("테스트은행 통장");
    await section.getByRole("button", { name: "등록" }).click();
    await expect(section.getByText("테스트은행 통장", { exact: true })).toBeVisible();

    await rowFor(page, section, "테스트은행 통장", "수정")
      .getByRole("button", { name: "수정" })
      .click();
    await editFormOf(section).locator('input[name="displayName"]').fill("테스트은행 통장(수정)");
    await editFormOf(section).getByRole("button", { name: "저장" }).click();
    await expect(section.getByText("테스트은행 통장(수정)", { exact: true })).toBeVisible();

    const updatedRow = rowFor(page, section, "테스트은행 통장(수정)", "비활성화");
    await updatedRow.getByRole("button", { name: "비활성화" }).click();
    await expect(rowFor(page, section, "테스트은행 통장(수정)", "활성화")).toBeVisible();

    await rowFor(page, section, "테스트은행 통장(수정)", "활성화")
      .getByRole("button", { name: "활성화" })
      .click();
    await expect(rowFor(page, section, "테스트은행 통장(수정)", "비활성화")).toBeVisible();
  });
});

test.describe("F-1-4-1 지출분류 관리 — 카드", () => {
  test("등록 → 수정 → 비활성화 → 활성화", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/payment-methods");
    const section = page.locator("section", { hasText: "카드" });

    await section.getByPlaceholder("카드사명 (예: 국민카드)").fill("테스트카드");
    await section.getByRole("button", { name: "등록" }).click();
    await expect(section.getByText("테스트카드", { exact: true })).toBeVisible();

    await rowFor(page, section, "테스트카드", "수정").getByRole("button", { name: "수정" }).click();
    await editFormOf(section).locator('input[name="displayName"]').fill("테스트카드(수정)");
    await editFormOf(section).getByRole("button", { name: "저장" }).click();
    await expect(section.getByText("테스트카드(수정)", { exact: true })).toBeVisible();

    await rowFor(page, section, "테스트카드(수정)", "비활성화")
      .getByRole("button", { name: "비활성화" })
      .click();
    await expect(rowFor(page, section, "테스트카드(수정)", "활성화")).toBeVisible();
  });
});

test.describe("F-1-4-2 지출항목 관리", () => {
  test("등록 → 수정 → 비활성화 → 활성화", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/categories");

    await page.getByPlaceholder("이름 (예: 외식)").fill("테스트항목");
    await page.getByRole("button", { name: "등록" }).click();
    await expect(page.getByText("테스트항목", { exact: true })).toBeVisible();

    await rowFor(page, page.locator("main"), "테스트항목", "수정")
      .getByRole("button", { name: "수정" })
      .click();
    await editFormOf(page.locator("main")).locator('input[name="name"]').fill("테스트항목(수정)");
    await editFormOf(page.locator("main")).getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("테스트항목(수정)", { exact: true })).toBeVisible();

    await rowFor(page, page.locator("main"), "테스트항목(수정)", "비활성화")
      .getByRole("button", { name: "비활성화" })
      .click();
    await expect(rowFor(page, page.locator("main"), "테스트항목(수정)", "활성화")).toBeVisible();

    await rowFor(page, page.locator("main"), "테스트항목(수정)", "활성화")
      .getByRole("button", { name: "활성화" })
      .click();
    await expect(rowFor(page, page.locator("main"), "테스트항목(수정)", "비활성화")).toBeVisible();
  });
});

test.describe("F-1-4-3 지출처 관리", () => {
  test("등록 → 수정 → 비활성화 → 활성화", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/vendors");

    await page.getByPlaceholder("이름 (예: 이마트)").fill("테스트지출처");
    await page.getByRole("button", { name: "등록" }).click();
    await expect(page.getByText("테스트지출처", { exact: true })).toBeVisible();

    await rowFor(page, page.locator("main"), "테스트지출처", "수정")
      .getByRole("button", { name: "수정" })
      .click();
    await editFormOf(page.locator("main")).locator('input[name="name"]').fill("테스트지출처(수정)");
    await editFormOf(page.locator("main")).getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("테스트지출처(수정)", { exact: true })).toBeVisible();

    await rowFor(page, page.locator("main"), "테스트지출처(수정)", "비활성화")
      .getByRole("button", { name: "비활성화" })
      .click();
    await expect(rowFor(page, page.locator("main"), "테스트지출처(수정)", "활성화")).toBeVisible();

    await rowFor(page, page.locator("main"), "테스트지출처(수정)", "활성화")
      .getByRole("button", { name: "활성화" })
      .click();
    await expect(
      rowFor(page, page.locator("main"), "테스트지출처(수정)", "비활성화")
    ).toBeVisible();
  });
});
