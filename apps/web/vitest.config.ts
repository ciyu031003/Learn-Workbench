import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": dir,
    },
  },
  test: {
    name: "web",
    root: dir,
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["**/*.ts"],
      exclude: ["**/*.test.ts", "**/vitest.config.ts", "**/node_modules/**", "next.config.ts", "proxy.ts", "**/.next/**"],
      // 棘轮阈值（组三 · H4）：按 2026-10-11 实测值下取整再降 1 个点 —— 只拦"往回退"。
      // 实测：statements 79.85 / branches 68.22 / functions 74.77 / lines 82.65。
      thresholds: {
        statements: 79,
        branches: 68,
        functions: 74,
        lines: 82,
      },
    },
  },
});

