import type { MetadataRoute } from "next";

// F-1-9-2: PWA 매니페스트 — 홈 화면 추가/오프라인 캐시 지원(아키텍처 설계서 6장).
// 아이콘은 로고 SVG가 아직 준비되지 않아 임시 플레이스홀더(브랜드 네이비 배경 + "pL" 텍스트,
// 헤더 로고와 동일한 톤) 사용 — public/icons/icon-*.png. 실제 로고 SVG 완성 후 교체할 것.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "payLens",
    short_name: "payLens",
    description: "Trusted Expense Analysis",
    start_url: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#0B2545",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
