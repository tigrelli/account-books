"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  savePendingExtraction,
  loadPendingExtraction,
  type PendingExtraction,
} from "@/lib/utility-bill-pending-storage";
import { hasUsageForLabel } from "@/lib/utility-bill-parse";
import { normalizeLabel } from "@/lib/utility-bill-format-match";
import { deactivateUnselectedUtilityBillItemsAction } from "../../actions";

// [F-2-2-1~2] 항목 선정 화면(화면설계 §2, `/utility-bills/upload/items`) — 최초 업로드
// 또는 형식변경(매칭률 < 50%) 감지 시에만 `/utility-bills/upload`에서 이 페이지로
// 진입한다(팝업이 아닌 별도 페이지, §2-1). extraction은 서버 액션이 아니라
// sessionStorage로 이 페이지에 넘어온다(lib/utility-bill-pending-storage.ts 참고).
//
// **범위**: "선택한 항목으로 저장"은 ①선택하지 않은 기존 활성 항목을 is_active=false로
// 전환(§2-3, deactivateUnselectedUtilityBillItemsAction)하고 ②선택된 항목만 남긴
// extraction으로 원래 확인 화면(F-2-1-3)으로 돌아간다 — 새로 선택된 라벨의
// UTILITY_BILL_ITEM 생성은 그 확인 화면의 기존 upsert 저장 로직이 그대로 처리한다.
interface LoadState {
  loaded: boolean;
  pending: PendingExtraction | null;
  selected: Set<string>;
}

export default function UtilityBillItemsPage() {
  const router = useRouter();
  // sessionStorage는 SSR에 없어 마운트 후에만 읽을 수 있다 — 세 값을 한 객체로 묶어
  // setState를 1회만 호출한다(react-hooks/set-state-in-effect, 외부 시스템을 마운트 시
  // 한 번만 동기화하는 정당한 용도).
  const [state, setState] = useState<LoadState>({
    loaded: false,
    pending: null,
    selected: new Set(),
  });

  useEffect(() => {
    const p = loadPendingExtraction();
    // sessionStorage는 SSR 대응이 없어 마운트 후 1회만 읽을 수 있다(외부 시스템 동기화, 이후 재실행 없음).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({
      loaded: true,
      pending: p,
      selected: p ? new Set(p.extraction.items.map((i) => i.label)) : new Set(),
    });
  }, []);

  const { loaded, pending, selected } = state;

  if (!loaded) return null;

  if (!pending) {
    return (
      <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">선택할 명세서가 없습니다.</p>
          <button
            type="button"
            onClick={() => router.push("/utility-bills/upload")}
            className="h-10 rounded-lg bg-[var(--paylens-action)] px-5 text-sm font-medium text-white hover:opacity-90"
          >
            업로드 화면으로
          </button>
        </div>
      </div>
    );
  }

  const { extraction, activeItems, replaceExisting, file } = pending;

  // 기존에 지정해둔 항목인데 이번 추출 결과엔 라벨이 없는 것 — 화면설계 §2-2 "이번 달에
  // 없음" 구획. sourceLabels 중 하나라도 이번 추출 라벨과 일치하면 "있음"으로 본다
  // (S-2-9 매칭 기준과 동일, 공백 정규화).
  const missingActiveItems = activeItems.filter(
    (active) =>
      !active.sourceLabels.some((alias) =>
        extraction.items.some((item) => normalizeLabel(item.label) === normalizeLabel(alias))
      )
  );

  function toggle(label: string) {
    setState((prev) => {
      const next = new Set(prev.selected);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return { ...prev, selected: next };
    });
  }

  async function handleSave() {
    if (selected.size === 0) return;
    const filteredItems = extraction.items.filter((item) => selected.has(item.label));
    await deactivateUnselectedUtilityBillItemsAction(filteredItems.map((item) => item.label));
    await savePendingExtraction(
      { ...extraction, items: filteredItems },
      file,
      replaceExisting,
      activeItems
    );
    router.push("/utility-bills/upload");
  }

  return (
    <div className="min-h-screen bg-[var(--paylens-bg)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">항목 선택</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            처음 등록하거나 명세서 양식이 바뀐 것 같아요 — 등록할 항목을 선택해주세요
          </p>
        </div>

        <div
          className="space-y-1 rounded-lg p-4"
          style={{ borderRadius: "var(--border-radius-m)", boxShadow: "var(--card-shadow)" }}
        >
          {extraction.items.map((item) => (
            <label
              key={item.label}
              className="flex cursor-pointer items-center justify-between gap-3 border-b border-[#e2e8f0] py-2 last:border-b-0"
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(item.label)}
                  onChange={() => toggle(item.label)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-[var(--color-text-primary)]">{item.label}</span>
                {hasUsageForLabel(item.label, extraction.usageTable) && (
                  <span className="rounded-full bg-[var(--paylens-action)]/10 px-2 py-0.5 text-xs text-[var(--paylens-action)]">
                    사용량 연결됨
                  </span>
                )}
              </span>
              <span className="font-mono text-sm text-[var(--color-text-primary)]">
                {item.amount.toLocaleString("ko-KR")}원
              </span>
            </label>
          ))}
        </div>

        {missingActiveItems.length > 0 && (
          <div
            className="space-y-1 rounded-lg p-4"
            style={{ borderRadius: "var(--border-radius-m)", boxShadow: "var(--card-shadow)" }}
          >
            <p className="mb-1 text-xs font-semibold text-[var(--color-text-secondary)]">
              이번 달에 없음
            </p>
            {missingActiveItems.map((active) => (
              <div
                key={active.name}
                className="flex items-center justify-between py-1 text-sm text-[var(--color-text-secondary)]"
              >
                <span>{active.name}</span>
                <span>비활성화됩니다</span>
              </div>
            ))}
          </div>
        )}

        {selected.size === 0 && (
          <p className="text-center text-xs text-[var(--paylens-accent)]">
            최소 1개 이상 선택해주세요
          </p>
        )}

        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => void handleSave()}
          className="h-10 w-full rounded-lg bg-[var(--paylens-action)] text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          선택한 항목으로 저장
        </button>
      </div>
    </div>
  );
}
