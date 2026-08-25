import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/**/__tests__/**/*.test.ts",
      "packages/**/src/**/__tests__/**/*.test.ts",
      "apps/**/src/**/__tests__/**/*.test.ts",
    ],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
    server: {
      deps: {
        // `node:sqlite` is a Node builtin (>=22.5); keep it external so vite
        // does not try to resolve it as a package.
        external: [/node:sqlite/],
      },
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
