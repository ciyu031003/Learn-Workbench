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
module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  }
]);
