/**
 * Node test loader（S5-1）：让 `node --test` 能跑 shared 的 .ts 模块。
 *
 * 为什么需要：shared 无构建产物、无 vitest；源码里按 bundler/tsc 习惯写**无扩展名**相对导入
 * （Web/Mobile 的打包器都认），而 Node ESM 不做扩展名补全，直接加载 .ts 会 ERR_MODULE_NOT_FOUND。
 * 这个 resolve hook 只做一件事：相对导入找不到时补 `.ts` 再试一次。
 * 仅用于本地/CI 跑 domains 单测，不参与 Web/Mobile 打包。
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
    try {
      return await nextResolve(specifier + ".ts", context);
    } catch {
      // 落回默认解析，让错误信息保持原样
    }
  }
  return nextResolve(specifier, context);
}
