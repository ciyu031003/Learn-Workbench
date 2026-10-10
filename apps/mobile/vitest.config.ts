import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

const dir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(dir, "src"),
    },
  },
  test: {
    name: "mobile",
    root: dir,
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["**/*.ts"],
      exclude: ["**/*.test.ts", "**/vitest.config.ts", "**/node_modules/**"],
      // 棘轮阈值（组三 · H4）：按 2026-10-11 实测值下取整再降 1 个点 —— 只拦"往回退"。
      // 实测：statements 64.84 / branches 60.05 / functions 64.04 / lines 65.89。
      thresholds: {
        statements: 64,
        branches: 60,
        functions: 64,
        lines: 65,
      },
    },
  },
});
