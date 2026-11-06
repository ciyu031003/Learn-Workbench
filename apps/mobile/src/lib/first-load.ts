/**
 * v2.2.2 · 「骨架屏只在首次无数据时出现」的状态机（纯函数，可单测）。
 *
 * 背景（真机反馈：切 Tab 时突然冒出骨架屏加载动画）：
 * Tab 场景是**常驻**的（detachInactiveScreens 只摘原生视图、不卸载 React 组件），
 * 所以每个页面在「聚焦回来」时会再拉一次数据。如果页面在**已经有数据**时又把
 * loading 置回 true，骨架屏就会顶掉整块内容 —— 用户看到的就是「切个 Tab 闪一下骨架」。
 *
 * 不变式（页面照这个写就不会再闪）：
 *  1. 骨架屏的唯一判据是 shouldShowSkeleton()：首轮请求未结束 **且** 还没有任何数据；
 *  2. firstLoadPending 只允许在组件挂载（useState 初值）时为 true；首轮请求无论
 *     成功 / 空 / 失败都立刻落定 false，之后 聚焦刷新、下拉刷新、失败重试、轮询
 *     一律**不得**再置回 true（nextFirstLoadGate 的 load-start 分支就是这条不变式）；
 *  3. 失败不能清空已有数据：hasData 保持 true，页面继续显示上一次的内容
 *     （最多少量降级提示），绝不退回骨架屏。
 *
 * 用法（wellness / career 已经是这样接的）：
 *   const [gate, setGate] = useState(INITIAL_FIRST_LOAD_GATE);
 *   const showSkeleton = shouldShowSkeleton(gate);
 *   // 请求成功：setGate((g) => nextFirstLoadGate(g, { type: "load-success" }));
 *   // 请求失败：setGate((g) => nextFirstLoadGate(g, { type: "load-failure" }));
 */

export interface FirstLoadGate {
  /** 首轮请求还没结束 —— 只有这个阶段才可能渲染骨架屏 */
  readonly firstLoadPending: boolean;
  /** 已经有可展示的数据（含上一次成功拉到的旧数据） */
  readonly hasData: boolean;
}

/** 组件挂载时的初态：首轮未结束、还没有数据 */
export const INITIAL_FIRST_LOAD_GATE: FirstLoadGate = {
  firstLoadPending: true,
  hasData: false,
};

/** 骨架屏唯一判据：首轮未结束且没有任何数据可展示 */
export function shouldShowSkeleton(gate: FirstLoadGate): boolean {
  return gate.firstLoadPending === true && gate.hasData !== true;
}

export type FirstLoadEvent =
  /** 聚焦 / 下拉刷新开始：**故意不改状态**（刷新永远不能把骨架屏放回来） */
  | { readonly type: "load-start" }
  /** 拉到了数据（首轮结束，或后台刷新换掉旧数据） */
  | { readonly type: "load-success" }
  /** 请求成功但确实没有数据（空态，不是骨架屏） */
  | { readonly type: "load-empty" }
  /** 请求失败：保留上一次的数据，不清空 */
  | { readonly type: "load-failure" };

/** 事件驱动的下一状态（不修改入参） */
export function nextFirstLoadGate(gate: FirstLoadGate, event: FirstLoadEvent): FirstLoadGate {
  switch (event.type) {
    case "load-start":
      return gate;
    case "load-success":
      return { firstLoadPending: false, hasData: true };
    case "load-empty":
      return { firstLoadPending: false, hasData: false };
    case "load-failure":
      return { firstLoadPending: false, hasData: gate.hasData === true };
    default:
      return gate;
  }
}
