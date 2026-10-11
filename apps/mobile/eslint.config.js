// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

/**
 * v17-A（R7）字阶护栏说明
 *
 * 目标：禁止 `src/app/**` 里**裸写数字字面量**的 `fontSize:`（必须是 `...typography.x` 展开、
 * 或来自 token 的表达式），杜绝"415 处硬编码字号"的回归。
 *
 * 为什么当前**没有启用**：实测 `src/app/**` 仍有 **430 处**真实违规（不是误报）——
 * 现在开启会让 `npx eslint src` 直接 430 error，破坏阶段 A 的"0 error"验收。
 * 收敛完成后（见 docs/APP端v17-A字阶收敛待办.md），把下面这段挪到 rules 里即可一行启用：
 *
 *   rules: {
 *     "no-restricted-syntax": ["error", {
 *       selector: "Property[key.name='fontSize'][value.type='Literal']",
 *       message: "请用 ...typography.x（见 theme/tokens.ts）；裸写数字字号会破坏字阶一致性",
 *     }],
 *   }
 *
 * 注意：该 selector 只命中**对象字面量里的数字字面量**（即 StyleSheet.create 里的写法），
 * 不会误伤 `fontSize: someToken.fontSize` 这类表达式；启用时还需要给
 * `src/theme/**` 开一个 ignores 覆盖，否则 tokens.ts 自己的 typography 也会被判红。
 */
/**
 * v1.44.0（门禁可信度修复）：lint 覆盖面补齐 + scripts/ 的 Node 全局
 *
 * 问题 1：`expo lint` 的 DEFAULT_INPUTS = ['src','app','components']（见
 *   node_modules/@expo/cli/build/src/lint/lintAsync.js:90），`scripts/` 长期不在扫描范围内 ——
 *   apps/mobile/scripts/gen-icons.mjs:48 的 'Buffer' is not defined (no-undef) 因此隐形了很久。
 *   修法：在 package.json 的 lint 脚本里显式传目录（`expo lint src scripts`），而不是依赖
 *   expo 的默认输入；同时这里给 scripts/** 补上 Node 全局，避免误报。
 *   注意：只列**实际存在**的目录 —— apps/mobile 下没有顶层 app/ 与 components/
 *   （它们位于 src/ 内），传不存在的目录会让 eslint 直接 "No files matching the pattern" 退出 2。
 *
 * 问题 2：eslint-config-expo/flat 只注入 browser globals（flat/default.js 的 globals.browser），
 *   对 Node 侧脚本（scripts/*.js|mjs、eslint.config.js 自己）会报 no-undef。
 */
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // 工程脚本跑在 Node 里（不是 RN 运行时）：显式声明 Node 全局。
    files: ["scripts/**/*.{js,mjs,cjs}", "*.config.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
]);
