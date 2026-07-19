import { fileURLToPath } from "node:url";
import { mergeConfig } from "vitest/config";
import baseConfig from "@account-books/config/vitest/base";

// tsconfig.json의 "@/*" 경로 별칭 — Next.js 빌드는 tsconfig를 읽어 자동 해석하지만
// vitest는 별도 resolve.alias가 필요하다(T-2-1에서 actions.ts를 처음 직접 import하며 발견,
// 기존 테스트는 전부 "@/..." import가 `import type`이라 트랜스파일 시 제거돼 드러나지 않았음).
export default mergeConfig(baseConfig, {
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: ["__tests__/**/*.test.ts"],
  },
});
