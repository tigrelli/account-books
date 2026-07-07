"use client";

import { useEffect, useState } from "react";

// 서버는 실제 화면 폭을 알 수 없어(User-Agent 추정은 부정확) 지출 목록의 기기별 페이지네이션은
// 클라이언트에서 matchMedia로 판별한다. 초기값은 "desktop"으로 둬 SSR 시점 렌더와 mount 직후
// 첫 렌더를 일치시키고(하이드레이션 불일치 방지), 실제 값은 effect에서 1회 갱신된다.
// Tailwind 브레이크포인트(md=768px, lg=1024px)와 동일한 기준.
export type ViewportTier = "mobile" | "tablet" | "desktop";

export function useViewportTier(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>("desktop");

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const tabletQuery = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");

    function update() {
      setTier(mobileQuery.matches ? "mobile" : tabletQuery.matches ? "tablet" : "desktop");
    }

    update();
    mobileQuery.addEventListener("change", update);
    tabletQuery.addEventListener("change", update);
    return () => {
      mobileQuery.removeEventListener("change", update);
      tabletQuery.removeEventListener("change", update);
    };
  }, []);

  return tier;
}
