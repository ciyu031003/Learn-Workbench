/**
 * 长列表窗口化纯逻辑（S3-8）。
 *
 * 目标：不引入虚拟化依赖的前提下，把「一次渲染几百条卡片」降为「首屏 30 条 + 加载更多」，
 * 逻辑抽成纯函数以便单测（组件只负责调用与渲染）。
 */

/** 默认每次渲染条数：30 条卡片在桌面/移动端都能保持一屏左右 + 半屏，避免"加载更多"按钮太频繁 */
export const DEFAULT_BATCH_SIZE = 30;

/** 把当前窗口大小夹到 [0, total]，避免数据变短后 slice 越界/显示空列表 */
export function clampWindow(shown: number, total: number): number {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const safeShown = Number.isFinite(shown) && shown > 0 ? Math.floor(shown) : 0;
  return Math.min(safeShown, safeTotal);
}

/** 点一次"加载更多"后的窗口大小（不超过 total） */
export function nextWindowSize(shown: number, total: number, batch: number = DEFAULT_BATCH_SIZE): number {
  const safeBatch = Number.isFinite(batch) && batch > 0 ? Math.floor(batch) : DEFAULT_BATCH_SIZE;
  return clampWindow(clampWindow(shown, total) + safeBatch, total);
}

/** 是否还有未展示的条目 */
export function hasMore(shown: number, total: number): boolean {
  return clampWindow(shown, total) < (Number.isFinite(total) && total > 0 ? Math.floor(total) : 0);
}

/** 取窗口内条目（永不 throw） */
export function visibleSlice<T>(items: readonly T[], shown: number): T[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.slice(0, clampWindow(shown, items.length)) as T[];
}

/** 列表底部文案：`已显示 30 / 155 道` */
export function windowLabel(shown: number, total: number, unit = "条"): string {
  const visible = clampWindow(shown, total);
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  return `已显示 ${visible} / ${safeTotal} ${unit}`;
}
