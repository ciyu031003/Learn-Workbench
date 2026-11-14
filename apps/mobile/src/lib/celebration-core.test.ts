import { describe, expect, it } from "vitest";
import {
  celebrationCopy,
  celebrationDayKey,
  celebrationKey,
  claimCelebrationInLog,
  parseCelebrationLog,
  pruneCelebrationLog,
  sanitizeEventId,
} from "./celebration-core";

describe("庆祝事件去重（同一天同一事件只弹一次）", () => {
  it("首次占用成功，同日重复被拒", () => {
    const day = "2026-11-15";
    const first = claimCelebrationInLog({}, "plan-complete", "2026-11-15", day);
    expect(first.claimed).toBe(true);

    const second = claimCelebrationInLog(first.log, "plan-complete", "2026-11-15", day);
    expect(second.claimed).toBe(false);
  });

  it("不同事件互不影响", () => {
    const day = "2026-11-15";
    const a = claimCelebrationInLog({}, "plan-complete", "2026-11-15", day);
    const b = claimCelebrationInLog(a.log, "chapter-complete", "track:stage:topic", day);
    expect(b.claimed).toBe(true);
    expect(Object.keys(b.log)).toHaveLength(2);
  });

  it("跨天后旧记录被剪掉，事件重新可庆祝", () => {
    const oldLog = { [celebrationKey("plan-complete", "d1", "2026-11-14")]: "2026-11-14" };
    const next = claimCelebrationInLog(oldLog, "plan-complete", "d2", "2026-11-15");
    expect(next.claimed).toBe(true);
    expect(Object.keys(next.log)).toEqual([celebrationKey("plan-complete", "d2", "2026-11-15")]);
  });

  it("事件 id 里的冒号不会造成 key 碰撞", () => {
    expect(sanitizeEventId("a:b")).toBe("a-b");
    expect(sanitizeEventId("")).toBe("default");
    const day = "2026-11-15";
    const a = claimCelebrationInLog({}, "chapter-complete", "a:b", day);
    const b = claimCelebrationInLog(a.log, "chapter-complete", "a", day);
    expect(b.claimed).toBe(true);
  });

  it("日志只保留当天", () => {
    const log = { a: "2026-11-14", b: "2026-11-15" };
    expect(pruneCelebrationLog(log, "2026-11-15")).toEqual({ b: "2026-11-15" });
  });

  it("损坏日志不会抛错", () => {
    expect(parseCelebrationLog("not json")).toEqual({});
    expect(parseCelebrationLog("[1,2]")).toEqual({});
    expect(parseCelebrationLog(JSON.stringify({ a: 1, b: "2026-11-15" }))).toEqual({ b: "2026-11-15" });
  });

  it("本地日期是 YYYY-MM-DD", () => {
    expect(celebrationDayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("庆祝文案", () => {
  it("每类事件都有非空标题与按钮，且 kicker 不重复堆叠", () => {
    const kinds = ["plan-complete", "chapter-complete", "drill-daily-20", "quiz-milestone", "focus-complete"] as const;
    const copies = kinds.map((kind) => celebrationCopy(kind));
    for (const copy of copies) {
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.buttonText.length).toBeGreaterThan(0);
      expect(copy.kicker.length).toBeGreaterThan(0);
    }
    expect(new Set(copies.map((c) => c.kicker)).size).toBeGreaterThanOrEqual(4);
  });

  it("自定义标题/副标题会覆盖默认值", () => {
    const copy = celebrationCopy("chapter-complete", { title: "数据结构 · 树", subtitle: "读完第 3 节" });
    expect(copy.title).toBe("数据结构 · 树");
    expect(copy.subtitle).toBe("读完第 3 节");
  });

  it("专注完成带分钟数时写进副标题", () => {
    expect(celebrationCopy("focus-complete", { minutes: 25 }).subtitle).toContain("25 分钟");
  });
});
