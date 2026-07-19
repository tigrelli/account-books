import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

// T-2-4: 관리비 전체 E2E(업로드→선정→통계→메인수정→불일치알림 확인). OCR은
// OCR_PROVIDER=fixture(playwright.config.ts)로 결정적 결과를 반환하므로 업로드하는 사진
// 파일 자체의 내용은 무시된다(브라우저 압축 단계에는 실제 디코딩 가능한 이미지가 필요할 뿐).
// docs/sample/의 실사진(개인정보 포함)은 .gitignore 처리돼 있어 CI 체크아웃엔 없다 — 대신
// 커밋된 합성 픽스처 이미지를 쓴다(2026-07-19, 실제 CI 실행에서 ENOENT로 발견, T-2-2와 동일 픽스처).
const testEmail = () => `full_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = "testpass123!";
const testName = "관리비전체플로우테스트";
const samplePhoto = path.resolve(__dirname, "./fixtures/utility-bill-sample.png");

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

// 팝업 문구("지정 항목 합계(A원)와 실제 등록 금액(B원)이 C원 다릅니다...")에서 숫자만 추출 —
// 픽스처가 반환하는 항목 구성(사용량표 일부 + 부가세제외항목만 지정됨)상 지정 항목 합계는
// 총액과 항상 큰 차이가 나므로(체크박스 4개 선택과 무관하게), 정확한 값을 하드코딩하는 대신
// 팝업에서 읽어 일관성만 검증한다.
function parseMismatchPopup(text: string): { itemsTotal: number; officialTotal: number } {
  const match = text.match(/지정 항목 합계\(([\d,]+)원\)와 실제 등록 금액\(([\d,]+)원\)/);
  const itemsTotalText = match?.[1];
  const officialTotalText = match?.[2];
  if (!itemsTotalText || !officialTotalText) {
    throw new Error(`불일치 팝업 문구를 파싱하지 못함: ${text}`);
  }
  return {
    itemsTotal: Number(itemsTotalText.replace(/,/g, "")),
    officialTotal: Number(officialTotalText.replace(/,/g, "")),
  };
}

test.describe("T-2-4 관리비 전체 E2E — 업로드→선정→통계→메인수정→불일치알림 확인", () => {
  test("소독비를 해제해 의도적으로 불일치를 만들고, 통계 알림 확인 후 메인에서 금액을 수정하면 불일치 알림이 갱신된다", async ({
    page,
  }) => {
    // 1. 업로드 → 항목 선정(F-2-1-1~F-2-2-2, T-2-2와 동일 경로) — "소독비"를 해제해 지정 항목
    //    합계와 총액(165,600원)이 의도적으로 달라지게 한다(F-2-4-2 대상).
    await signUpAndLogin(page);

    await page.goto("/utility-bills/upload");
    await page.setInputFiles('input[type="file"]', samplePhoto);
    await page.waitForURL(/\/utility-bills\/upload\/items/, { timeout: 30000 });

    const rows = page.locator('label:has(input[type="checkbox"])');
    await expect(rows).toHaveCount(4);
    for (let i = 0; i < (await rows.count()); i++) {
      await rows.nth(i).locator('input[type="checkbox"]').check();
    }
    await rows.filter({ hasText: "소독비" }).locator('input[type="checkbox"]').uncheck();
    await page.getByRole("button", { name: "선택한 항목으로 저장" }).click();

    await page.waitForURL(/\/utility-bills\/upload$/, { timeout: 15000 });
    await expect(page.getByText("결제수단과 지출일을 선택해주세요")).toBeVisible();
    await page.getByRole("button", { name: "확인" }).click();

    await expect(page.getByText("2026-07 청구월")).toBeVisible();
    await expect(page.getByText("소독비")).toHaveCount(0);
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("관리비는 말일로 지출 등록됩니다.")).toBeVisible();
    await page.getByRole("button", { name: "확인" }).click();
    await page.waitForURL(/\/expenses/, { timeout: 10000 });
    await expect(page.getByText("관리사무소")).toBeVisible();

    // 2. 통계 화면(F-2-3-x) — 총액 불일치 알림(F-2-4-2)이 최초부터 노출되고, 클릭하면 정확한
    //    금액/차액이 담긴 팝업이 뜬다.
    await page.goto("/utility-bills/stats");
    await expect(page.getByText("총액 불일치")).toBeVisible();
    await page.getByText("총액 불일치").click();
    const firstPopupText =
      (await page.getByRole("dialog").getByRole("paragraph").textContent()) ?? "";
    const first = parseMismatchPopup(firstPopupText);
    expect(first.officialTotal).toBe(165600);
    expect(first.itemsTotal).toBeLessThan(first.officialTotal);
    await page.getByRole("button", { name: "확인" }).click();

    // 3. 메인 앱 지출 수정 화면(F-2-4-1) — 업로드로 등록된 지출이므로 안내 아이콘이 있고,
    //    클릭하면 펼쳐지고 재클릭하면 접힌다.
    await page.goto("/expenses");
    await page.getByText("관리사무소").click();
    await page.waitForURL(/\/expenses\/[^/]+\/edit/, { timeout: 10000 });

    const infoIcon = page.locator('button[aria-label="관리비 명세서 안내"]');
    await expect(infoIcon).toBeVisible();
    await expect(page.getByText("이 지출은 관리비 명세서로 등록되었습니다")).toHaveCount(0);
    await infoIcon.click();
    await expect(page.getByText("이 지출은 관리비 명세서로 등록되었습니다")).toBeVisible();
    await infoIcon.click();
    await expect(page.getByText("이 지출은 관리비 명세서로 등록되었습니다")).toHaveCount(0);

    // 4. 금액을 직접 수정하고 저장 → 안내 팝업이 뜨고, 확인해야 목록으로 이동한다.
    await page.fill("#amount-visible", "170000");
    await page.click('button[type="submit"]:has-text("수정")');
    await expect(page.getByText("이 지출은 관리비 명세서로 등록되었습니다")).toBeVisible();
    await expect(page.url()).toContain("/edit"); // 확인 전엔 아직 이동하지 않음
    await page.getByRole("button", { name: "확인" }).click();
    await page.waitForURL(/\/expenses(\?.*)?$/, { timeout: 10000 });

    // 5. 통계 화면으로 돌아가면 불일치 알림이 수정된 총액(170,000원) 기준으로 갱신돼 있다 —
    //    지정 항목 합계는 그대로, 실제 등록 금액만 방금 수정한 값으로 바뀐다.
    await page.goto("/utility-bills/stats");
    await expect(page.getByText("총액 불일치")).toBeVisible();
    await page.getByText("총액 불일치").click();
    const secondPopupText =
      (await page.getByRole("dialog").getByRole("paragraph").textContent()) ?? "";
    const second = parseMismatchPopup(secondPopupText);
    expect(second.officialTotal).toBe(170000);
    expect(second.itemsTotal).toBe(first.itemsTotal);
  });
});
