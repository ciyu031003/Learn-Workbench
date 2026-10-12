import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

// v1.45：显式 `.toString()` —— 根 node_modules 的 tsc 5.9 会把全局 `URL` 判成
// 与 `import("url").URL` 不兼容（TS2345，与本功能无关的历史环境问题），转成 string 后两边一致。
const dir = fileURLToPath(new URL(".", import.meta.url).toString());

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
