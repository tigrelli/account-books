"use client";

import { useEffect, useRef } from "react";

// 지출입력 화면 등에서 저장 직후 "다른 화면으로 이동할지"만 짧게 물어보는 하단 토스트(PM 요청,
// 2026-07-05) — ConfirmDialog/SuccessDialog(중앙 모달)와 달리 화면을 가리지 않고 잠시 떠 있다가
// 자동으로 사라진다. 데스크탑 사이드바(w-56, md 이상)만큼 오프셋을 줘서 본문 영역 기준으로
// 가운데 정렬되고, 모바일 홈 인디케이터에 가리지 않도록 safe-area-inset-bottom을 더한다.
export function ActionToast({
  open,
  message,
  actionLabel,
  onAction,
  onDismiss,
  autoDismissMs = 6000,
}: {
  open: boolean;
  message: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
  autoDismissMs?: number;
}) {
  // onAction/onDismiss가 매 렌더마다 새로 만들어져도(부모의 인라인 콜백) 자동 닫힘 타이머가
  // 계속 리셋되지 않도록 최신 콜백만 ref로 추적하고, 타이머 자체는 open 전환 시에만 새로 건다.
  // ref 갱신은 렌더 중이 아니라 커밋 이후(effect)에서 해야 안전하다(react-hooks/refs).
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => onDismissRef.current(), autoDismissMs);
    return () => clearTimeout(timer);
  }, [open, autoDismissMs]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 z-50 flex justify-center px-4 md:left-56"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex w-full max-w-xl items-center justify-between gap-3 rounded-xl bg-[var(--color-text-primary)] px-4 py-3 shadow-lg">
        <p className="text-sm text-white">{message}</p>
        <div className="flex shrink-0 items-center gap-4">
          <button
            type="button"
            onClick={onAction}
            className="text-sm font-semibold text-[var(--paylens-action)] hover:underline"
          >
            {actionLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="닫기"
            className="text-sm text-white/60 hover:text-white"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
