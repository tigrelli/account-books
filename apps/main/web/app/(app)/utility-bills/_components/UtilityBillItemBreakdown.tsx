import {
  UTILITY_BILL_SECTIONS,
  ELECTRICITY_SEDAE_LABEL,
  ELECTRICITY_GONGDONG_LABEL,
  WATER_SEDAE_LABEL,
  WATER_GONGDONG_LABEL,
  type UtilityBillItemCandidate,
} from "@/lib/utility-bill-parse";

// [F-2-1-3, F-2-4-4] 명세서 원본의 구획(부가세항목/부가세제외항목/전기·수도료)별로 표+소계를
// 보여주는 공용 컴포넌트 — 업로드 확인 화면(F-2-1-3)과 명세서 이력 화면(F-2-4-4)이 함께 쓴다
// (2026-07-19, F-2-4-4 작업 중 업로드 확인 화면에서 추출).
function ItemSectionTable({ title, items }: { title: string; items: UtilityBillItemCandidate[] }) {
  if (items.length === 0) return null;
  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {items.map((item, i) => (
              <tr key={`${title}-${i}`} className="border-b border-[#e2e8f0] last:border-b-0">
                <td className="py-1.5 pr-3 text-[var(--color-text-secondary)]">{item.label}</td>
                <td className="py-1.5 text-right font-mono text-[var(--color-text-primary)]">
                  {item.amount.toLocaleString("ko-KR")}원
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-2 text-sm font-semibold text-[var(--color-text-primary)]">소계</td>
              <td className="pt-2 text-right font-mono text-sm font-semibold text-[var(--color-text-primary)]">
                {subtotal.toLocaleString("ko-KR")}원
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// "전기·수도료" 섹션 전용 레이아웃(2026-07-14, PM 확인) — 원본 영수증의 해당 구역이
// "전기료(세대/공동) | 수도료(세대/공동)" 2열 구조에 "부가세" 한 줄이 그 아래 따로
// 붙는 형태라, 다른 두 섹션(부가세항목/부가세제외항목)과 달리 ItemSectionTable의 단순
// 1열 표를 쓰지 않고 이 구조를 그대로 재현한다.
function UtilityFeeSectionTable({ items }: { items: UtilityBillItemCandidate[] }) {
  if (items.length === 0) return null;
  const electricity = items.filter(
    (i) => i.label === ELECTRICITY_SEDAE_LABEL || i.label === ELECTRICITY_GONGDONG_LABEL
  );
  const water = items.filter(
    (i) => i.label === WATER_SEDAE_LABEL || i.label === WATER_GONGDONG_LABEL
  );
  const rest = items.filter((i) => !electricity.includes(i) && !water.includes(i)); // "부가세" 등
  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);

  const feeRows = (rows: UtilityBillItemCandidate[], keyPrefix: string) =>
    rows.map((item, i) => (
      <tr key={`${keyPrefix}-${i}`} className="border-b border-[#e2e8f0] last:border-b-0">
        <td className="py-1.5 pr-3 text-[var(--color-text-secondary)]">
          {item.label.replace(/^(전기료|수도료)/, "").replace(/[()]/g, "")}
        </td>
        <td className="py-1.5 text-right font-mono text-[var(--color-text-primary)]">
          {item.amount.toLocaleString("ko-KR")}원
        </td>
      </tr>
    ));

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">전기·수도료</p>
      <div className="grid grid-cols-2 gap-x-4">
        <div className="overflow-x-auto">
          <p className="mb-1 text-xs text-[var(--color-text-secondary)]/70">전기료</p>
          <table className="w-full border-collapse text-sm">
            <tbody>{feeRows(electricity, "electricity")}</tbody>
          </table>
        </div>
        <div className="overflow-x-auto">
          <p className="mb-1 text-xs text-[var(--color-text-secondary)]/70">수도료</p>
          <table className="w-full border-collapse text-sm">
            <tbody>{feeRows(water, "water")}</tbody>
          </table>
        </div>
      </div>

      {rest.map((item, i) => (
        <div
          key={`rest-${i}`}
          className="mt-2 flex items-center justify-between border-t border-[#e2e8f0] pt-2 text-sm"
        >
          <span className="text-[var(--color-text-secondary)]">{item.label}</span>
          <span className="font-mono text-[var(--color-text-primary)]">
            {item.amount.toLocaleString("ko-KR")}원
          </span>
        </div>
      ))}

      <div className="mt-1 flex items-center justify-between pt-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span>소계</span>
        <span className="font-mono">{subtotal.toLocaleString("ko-KR")}원</span>
      </div>
    </div>
  );
}

// 명세서의 "관리비 납입" 표를 원본 구획(부가세항목/부가세제외항목/전기·수도료) 그대로 옮긴
// 형태 + 합계 — 업로드 확인 화면/이력 화면이 공유하는 최상위 조합.
export function UtilityBillItemBreakdown({
  items,
  total,
}: {
  items: UtilityBillItemCandidate[];
  total: number;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {UTILITY_BILL_SECTIONS.slice(0, 2).map((section) => (
          <ItemSectionTable
            key={section}
            title={section}
            items={items.filter((i) => i.section === section)}
          />
        ))}
      </div>
      <UtilityFeeSectionTable items={items.filter((i) => i.section === "전기·수도료")} />

      <div className="flex items-center justify-between border-t border-[#e2e8f0] pt-3">
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">합계</span>
        <span className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
          {total.toLocaleString("ko-KR")}원
        </span>
      </div>
    </div>
  );
}
