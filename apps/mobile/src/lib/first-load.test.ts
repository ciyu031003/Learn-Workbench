import { describe, expect, it } from "vitest";
import {
  INITIAL_FIRST_LOAD_GATE,
  nextFirstLoadGate,
  shouldShowSkeleton,
  type FirstLoadGate,
} from "./first-load";

const settledWithData: FirstLoadGate = { firstLoadPending: false, hasData: true };
const settledEmpty: FirstLoadGate = { firstLoadPending: false, hasData: false };

describe("shouldShowSkeleton", () => {
  it("只有「首轮未结束 + 还没有数据」才渲染骨架屏", () => {
    expect(shouldShowSkeleton(INITIAL_FIRST_LOAD_GATE)).toBe(true);
    expect(shouldShowSkeleton({ firstLoadPending: true, hasData: true })).toBe(false);
    expect(shouldShowSkeleton(settledEmpty)).toBe(false);
    expect(shouldShowSkeleton(settledWithData)).toBe(false);
  });
});

describe("nextFirstLoadGate", () => {
  it("load-success：首轮落定，之后永远不再渲染骨架屏", () => {
    const after = nextFirstLoadGate(INITIAL_FIRST_LOAD_GATE, { type: "load-success" });
    expect(after).toEqual({ firstLoadPending: false, hasData: true });
    expect(shouldShowSkeleton(after)).toBe(false);
  });

  it("load-empty：请求成功但没有数据 → 空态而不是骨架屏", () => {
    const after = nextFirstLoadGate(INITIAL_FIRST_LOAD_GATE, { type: "load-empty" });
    expect(after).toEqual({ firstLoadPending: false, hasData: false });
    expect(shouldShowSkeleton(after)).toBe(false);
  });

  it("load-failure：首轮失败也落定（页面走自己的降级 / 重试条）", () => {
    const after = nextFirstLoadGate(INITIAL_FIRST_LOAD_GATE, { type: "load-failure" });
    expect(after).toEqual({ firstLoadPending: false, hasData: false });
    expect(shouldShowSkeleton(after)).toBe(false);
  });

  it("关键不变式：刷新开始（load-start）不会把骨架屏放回来", () => {
    for (const gate of [settledWithData, settledEmpty]) {
      const after = nextFirstLoadGate(gate, { type: "load-start" });
      expect(after).toBe(gate);
      expect(shouldShowSkeleton(after)).toBe(false);
    }
    // 首轮还没结束时重复 load-start 也不会改变任何东西
    expect(nextFirstLoadGate(INITIAL_FIRST_LOAD_GATE, { type: "load-start" })).toBe(
      INITIAL_FIRST_LOAD_GATE,
    );
  });

  it("失败不会清空已有数据（hasData 保持 true，内容不被骨架屏替换）", () => {
    const after = nextFirstLoadGate(settledWithData, { type: "load-failure" });
    expect(after).toEqual({ firstLoadPending: false, hasData: true });
    expect(shouldShowSkeleton(after)).toBe(false);
  });

  it("状态机幂等：重复同一事件不改变结果", () => {
    const once = nextFirstLoadGate(INITIAL_FIRST_LOAD_GATE, { type: "load-success" });
    expect(nextFirstLoadGate(once, { type: "load-success" })).toEqual(once);
    expect(nextFirstLoadGate(once, { type: "load-failure" })).toEqual(once);
  });
});
