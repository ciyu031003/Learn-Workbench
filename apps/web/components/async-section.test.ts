import { describe, expect, it } from "vitest";
import { canRetry, sectionAriaBusy, sectionRole } from "./async-section";

/**
 * 说明：async-section 的测试放在 .test.ts（纯函数层）而不是 .test.tsx。
 * 当前 vitest include 只匹配 .test.ts 后缀、且 environment=node（无 jsdom/@testing-library），
 * 组件渲染逻辑由 typecheck + e2e 保证，这里锁三态映射的纯逻辑。
 */
describe("sectionRole（可访问性）", () => {
  it("loading / empty 用 status（polite 播报）", () => {
    expect(sectionRole("loading")).toBe("status");
    expect(sectionRole("empty")).toBe("status");
  });

  it("error 用 alert（紧急播报）", () => {
    expect(sectionRole("error")).toBe("alert");
  });

  it("ready 不挂 role", () => {
    expect(sectionRole("ready")).toBeUndefined();
  });
});

describe("sectionAriaBusy", () => {
  it("只有 loading 标记 aria-busy", () => {
    expect(sectionAriaBusy("loading")).toBe(true);
    expect(sectionAriaBusy("ready")).toBeUndefined();
    expect(sectionAriaBusy("error")).toBeUndefined();
    expect(sectionAriaBusy("empty")).toBeUndefined();
  });
});

describe("canRetry", () => {
  it("error + onRetry -> 显示重试", () => {
    expect(canRetry("error", true)).toBe(true);
    expect(canRetry("error", false)).toBe(false);
  });

  it("empty 默认不显示重试，显式 retryOnEmpty 才显示", () => {
    expect(canRetry("empty", true)).toBe(false);
    expect(canRetry("empty", true, true)).toBe(true);
  });

  it("loading / ready 永不显示重试", () => {
    expect(canRetry("loading", true, true)).toBe(false);
    expect(canRetry("ready", true, true)).toBe(false);
  });
});
