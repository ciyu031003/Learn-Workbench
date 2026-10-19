/**
 * 视口懒加载的纯决策逻辑（S3-6），与 `components/lazy-when-visible.tsx` 配套。
 * 抽成纯函数的原因：jsdom 未安装，组件本身难做单测；把可判定的分支（是否立即挂载、
 * rootMargin 归一化）抽出来就能覆盖。
 */

/** 默认提前触发距离：200px 约等于"下一屏还没滚到就预取"，兼顾流量与观感 */
export const DEFAULT_ROOT_MARGIN = "200px 0px";

/**
 * 是否跳过观察、立即渲染。
 * 目前只有显式 `disabled`（父级已知在首屏/必须立即出现）会立即渲染；
 * 用纯函数表达是为了把"立即渲染"策略集中在一处，避免组件里散落 if。
 */
export function shouldMountImmediately(options: { disabled?: boolean } = {}): boolean {
  return options.disabled === true;
}

/**
 * rootMargin 归一化：空串/纯空白/非字符串回退默认值；否则 trim 后返回。
 * （IntersectionObserver 对非法 rootMargin 会静默忽略，先归一化便于排查。）
 */
export function normalizeRootMargin(rootMargin?: string | null): string {
  if (typeof rootMargin !== "string") return DEFAULT_ROOT_MARGIN;
  const trimmed = rootMargin.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_ROOT_MARGIN;
}
