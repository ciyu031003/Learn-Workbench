import { describe, it, expect } from "vitest";
import { MIN_FOCUS_SECONDS, MIN_EXERCISE_SECONDS, MAX_SESSION_SECONDS } from "../focus-session";

describe("focus-session 阈值", () => {
  it("专注最短记录阈值为 5 秒（学了 2 分钟退出会记录）", () => {
    expect(MIN_FOCUS_SECONDS).toBe(5);
  });
  it("运动最短记录阈值 1 分钟", () => {
    expect(MIN_EXERCISE_SECONDS).toBe(60);
  });
  it("单会话上限 12 小时", () => {
    expect(MAX_SESSION_SECONDS).toBe(12 * 3600);
  });
});
