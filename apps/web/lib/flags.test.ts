import { describe, it, expect } from "vitest";
import { FLAGS, flagsSnapshot, isFlagEnabled } from "./flags";

const env = (over: Record<string, string | undefined> = {}) => ({ ...over }) as NodeJS.ProcessEnv;

describe("isFlagEnabled（H4 特性开关）", () => {
  it("缺省用代码里的 defaultEnabled", () => {
    expect(isFlagEnabled("ai_tip", env())).toBe(FLAGS.ai_tip.defaultEnabled);
  });

  it("单开关：FEATURE_AI_TIP=off 关闭", () => {
    for (const v of ["off", "0", "false", "FALSE", "no", " off "]) {
      expect(isFlagEnabled("ai_tip", env({ FEATURE_AI_TIP: v }))).toBe(false);
    }
  });

  it("单开关：显式打开也认（可用于给默认关闭的开关放量）", () => {
    expect(isFlagEnabled("internal_content_web", env({ FEATURE_INTERNAL_CONTENT_WEB: "on" }))).toBe(true);
    expect(isFlagEnabled("internal_content_web", env({ FEATURE_INTERNAL_CONTENT_WEB: "1" }))).toBe(true);
  });

  it("批量 JSON 覆盖单开关", () => {
    expect(
      isFlagEnabled("ai_tip", env({ FEATURE_FLAGS: '{"ai_tip":false}', FEATURE_AI_TIP: "on" }))
    ).toBe(false);
  });

  it("无法识别的取值 → 回落默认（不静默关掉功能）", () => {
    expect(isFlagEnabled("ai_tip", env({ FEATURE_AI_TIP: "maybe" }))).toBe(FLAGS.ai_tip.defaultEnabled);
  });

  it("坏 JSON 不炸服务，按未配置处理", () => {
    expect(isFlagEnabled("ai_tip", env({ FEATURE_FLAGS: "{oops" }))).toBe(FLAGS.ai_tip.defaultEnabled);
    expect(isFlagEnabled("ai_tip", env({ FEATURE_FLAGS: "[1,2]" }))).toBe(FLAGS.ai_tip.defaultEnabled);
  });

  it("快照覆盖全部已声明的开关", () => {
    const snap = flagsSnapshot(env({ FEATURE_AI_TIP: "off" }));
    expect(Object.keys(snap).sort()).toEqual(Object.keys(FLAGS).sort());
    expect(snap.ai_tip).toBe(false);
  });
});
