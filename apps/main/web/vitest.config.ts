import { mergeConfig } from "vitest/config";
import baseConfig from "@account-books/config/vitest/base";

export default mergeConfig(baseConfig, {
  test: {
    include: ["__tests__/**/*.test.ts"],
  },
});
