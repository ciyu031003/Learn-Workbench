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
      // 棘轮阈值（组三 · H4）：只拦"往回退"。
      // 锚定 2026-11-01 实测（下取整）：statements 76.5 / branches 68.62 / functions 70.46 / lines 79.48。
      // 重锚原因：依赖审计门禁 2026-08-23 起红灯，覆盖率步直到 11-01 才真正运行；
      // 期间并入 sync v2.1 / 安全加固等批次稀释了比值。此后继续只拦下降。
      thresholds: {
        statements: 76,
        branches: 68,
        functions: 70,
        lines: 79,
      },
    },
  },
});

