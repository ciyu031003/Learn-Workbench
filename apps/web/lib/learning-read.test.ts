import { describe, expect, it } from "vitest";
import type { LearningFavorite, LearningReadState } from "@learn-workbench/shared";
import { READ_WEEK_DAYS, summarizeLibraryState } from "./learning-read";

const now = new Date("2026-10-10T12:00:00.000Z");

function read(lastReadAt: string, overrides: Partial<LearningReadState> = {}): LearningReadState {
  return {
    pointKey: "python/base/topic",
    trackSlug: "python",
    stageKey: "base",
    topicKey: "topic",
    firstReadAt: "2026-01-01T00:00:00.000Z",
    lastReadAt,
    progress: 100,
    readCount: 1,
    ...overrides,
  };
}

function favorite(createdAt: string): LearningFavorite {
  return {
    pointKey: "python/base/topic",
    trackSlug: "python",
    stageKey: "base",
    topicKey: "topic",
    note: null,
    createdAt,
  };
}

describe("summarizeLibraryState（纯函数，注入 now）", () => {
  it("空状态全为 0", () => {
    expect(summarizeLibraryState([], [], now)).toEqual({ read: 0, favorites: 0, readThisWeek: 0 });
  });

  it("本周在读按 last_read_at 与 7 天窗口算，不用 first_read_at", () => {
    const rows = [
      read("2026-10-09T00:00:00.000Z"), // 昨天 → 本周
      read("2026-10-04T00:00:00.000Z", { pointKey: "b" }), // 6 天前 → 本周
      read("2026-10-01T00:00:00.000Z", { pointKey: "c" }), // 9 天前 → 不算（虽然 firstReadAt 很老也一样）
      read("2026-01-01T00:00:00.000Z", { pointKey: "d" }),
    ];
    expect(summarizeLibraryState(rows, [], now)).toEqual({ read: 4, favorites: 0, readThisWeek: 2 });
  });

  it("窗口边界：正好 7 天前算本周，7 天零 1 毫秒前不算", () => {
    const boundary = new Date(now.getTime() - READ_WEEK_DAYS * 86_400_000);
    const justInside = new Date(boundary.getTime() + 1).toISOString();
    const justOutside = new Date(boundary.getTime() - 1).toISOString();
    expect(summarizeLibraryState([read(justInside)], [], now).readThisWeek).toBe(1);
    expect(summarizeLibraryState([read(justOutside)], [], now).readThisWeek).toBe(0);
  });

  it("收藏计数与创建时间无关（已取消的收藏不会出现在入参里）", () => {
    expect(summarizeLibraryState([read("2026-10-09T00:00:00.000Z")], [favorite("2020-01-01T00:00:00.000Z")], now)).toEqual({
      read: 1,
      favorites: 1,
      readThisWeek: 1,
    });
  });
});
