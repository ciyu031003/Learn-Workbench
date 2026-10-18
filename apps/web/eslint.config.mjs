import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 测试覆盖率产物（vitest --coverage 生成，非源码）
    "coverage/**",
    // 静态资源（图片/字体），不是可 lint 的源码
    "public/**",
  ]),
]);

export default eslintConfig;
