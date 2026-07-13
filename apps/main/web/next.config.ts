import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@account-books/ui", "@account-books/types", "@account-books/utils"],
  // [F-2-1-2] 관리비 명세서 사진을 Server Action으로 직접 보내 OCR을 돌리는데(actions.ts의
  // extractUtilityBillAction), 기본 1MB 제한에 실제 폰카메라 사진(2~3MB대)이 걸려 500 에러가
  // 났다(2026-07-13 실사진 검증). 클라이언트 쪽 압축(UtilityBillUploadSection.tsx)과 함께
  // 이중 방어 — 압축이 실패해도 4MB까진 통과하도록.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
