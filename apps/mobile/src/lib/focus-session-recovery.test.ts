import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * v1.44.2：「计时中途退出也要记上」的补记口径单测。
 * 真机反馈是"只有点『记住本次记录』才记时间，退出就没了"。
 *
 * 需要 mock 原生模块：AsyncStorage（本文件用内存 Map 顶替，顺便测存取往返）。
 */
const mem = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => mem.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));

const {
  MAX_RECOVER_SECONDS,
  MIN_RECOVER_SECONDS,
  RUNNING_FOCUS_KEY,
  clearRunningFocus,
  loadRunningFocus,
  recoveredSeconds,
  saveRunningFocus,
} = await import("./focus-session-recovery");

type Session = Parameters<typeof saveRunningFocus>[0];

const base = (over: Partial<Session> = {}): Session => ({
  startedAt: 1_000_000,
  sessionMode: "focus",
  kind: "stopwatch",
  plannedSeconds: 0,
  taskId: null,
  contentLabel: null,
  exerciseLabel: null,
  ...over,
});

const at = (seconds: number) => 1_000_000 + seconds * 1000;

describe("recoveredSeconds（纯函数）", () => {
  it("跑够时间就按墙钟差补记", () => {
    expect(recoveredSeconds(base(), at(600))).toBe(600);
  });

  it("太短不补记（避免点开看一眼也生成记录）", () => {
    expect(recoveredSeconds(base(), at(MIN_RECOVER_SECONDS - 1))).toBe(0);
    expect(recoveredSeconds(base(), at(MIN_RECOVER_SECONDS))).toBe(MIN_RECOVER_SECONDS);
  });

  it("倒计时最多补记到计划时长（后台躺再久也不虚报）", () => {
    const s = base({ kind: "countdown", plannedSeconds: 1500 });
    expect(recoveredSeconds(s, at(1800))).toBe(1500);
    expect(recoveredSeconds(s, at(600))).toBe(600);
  });

  it("秒表按实际时长，但封顶 12 小时（忘关的计时器不会补出几天）", () => {
    expect(recoveredSeconds(base(), at(MAX_RECOVER_SECONDS + 99999))).toBe(MAX_RECOVER_SECONDS);
  });

  it("时钟回拨 / 异常时间戳返回 0，不会算出负数", () => {
    expect(recoveredSeconds(base(), 1_000_000 - 60_000)).toBe(0);
    expect(recoveredSeconds(base({ startedAt: Number.NaN }), at(100))).toBe(0);
  });

  it("运动会话与专注会话走同一套时长口径", () => {
    const s = base({ sessionMode: "exercise", exerciseLabel: "跑步" });
    expect(recoveredSeconds(s, at(1200))).toBe(1200);
  });
});

describe("运行中会话的存取", () => {
  beforeEach(() => mem.clear());

  it("存进去能原样读出来（进程被杀后靠它补记）", async () => {
    const s = base({ kind: "countdown", plannedSeconds: 1500, taskId: 7, contentLabel: "算法" });
    await saveRunningFocus(s);
    expect(await loadRunningFocus()).toEqual(s);
  });

  it("清掉之后读到 null", async () => {
    await saveRunningFocus(base());
    await clearRunningFocus();
    expect(await loadRunningFocus()).toBeNull();
  });

  it("存的是坏数据时返回 null 而不是抛错崩溃", async () => {
    mem.set(RUNNING_FOCUS_KEY, "{not json");
    expect(await loadRunningFocus()).toBeNull();
  });

  it("字段不合法（缺 startedAt / sessionMode 非法）也当没有，并顺手清掉", async () => {
    mem.set(RUNNING_FOCUS_KEY, JSON.stringify({ startedAt: "x", sessionMode: "focus", kind: "stopwatch" }));
    expect(await loadRunningFocus()).toBeNull();
    expect(mem.has(RUNNING_FOCUS_KEY)).toBe(false);
  });

  it("可选字段缺失时补默认值（旧版本写下的标记也能读）", async () => {
    mem.set(
      RUNNING_FOCUS_KEY,
      JSON.stringify({ startedAt: 1_000_000, sessionMode: "focus", kind: "stopwatch" })
    );
    const s = await loadRunningFocus();
    expect(s).not.toBeNull();
    expect(s?.plannedSeconds).toBe(0);
    expect(s?.taskId).toBeNull();
    expect(s?.contentLabel).toBeNull();
  });
});
