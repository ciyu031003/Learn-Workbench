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
      thresholds: {
        statements: 80,
        branches: 60,
        functions: 80,
        lines: 85,
      },
    },
  },
});
