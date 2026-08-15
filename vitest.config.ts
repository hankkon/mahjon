import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/src/**/__tests__/**/*.test.ts",
      "apps/**/src/**/__tests__/**/*.test.ts",
    ],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      // `@taiwan-mahjong/rules` is a workspace package whose exports point to
      // `dist/` which is not built during tests. Alias straight to the source.
      "@taiwan-mahjong/rules": path.resolve(__dirname, "packages/rules/src/index.ts"),
    },
  },
});
