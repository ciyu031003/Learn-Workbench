import { describe, expect, it } from "vitest";
import {
  FOCUS_SESSION_MAX_SECONDS,
  clearFocusSession,
  createFocusSessionState,
  focusElapsedSecondsAt,
  focusMinutesToSeconds,
  focusRemainingSecondsAt,
  focusSessionReducer,
  focusStorageKey,
  isFocusFinishedAt,
  loadFocusSession,
  restoreFocusSession,
  saveFocusSession,
  serializeFocusSession,
  type FocusSessionStorage,
  type FocusSessionState,
} from "./use-focus-session";

const T0 = Date.parse("2026-10-19T12:00:00.000Z");

function idle(minutes = 25, mode: "countdown" | "stopwatch" = "countdown"): FocusSessionState {
  return createFocusSessionState({ mode, minutes, nowMs: T0 });
}

function startAt(state: FocusSessionState, nowMs = T0): FocusSessionState {
  return focusSessionReducer(state, { type: "START", nowMs });
}

describe("focus 状态机（S6-4）", () => {
  it("初始 idle + 分钟换算 + 非法参数钳位", () => {
    const s = idle(25);
    expect(s.phase).toBe("idle");
    expect(s.totalSeconds).toBe(1500);
    expect(focusElapsedSecondsAt(s, T0)).toBe(0);
    expect(focusRemainingSecondsAt(s, T0)).toBe(1500);
    // 异常参数：NaN/负数回退 25 分钟，超过上限钳位
    expect(focusMinutesToSeconds(Number.NaN)).toBe(1500);
    expect(focusMinutesToSeconds(-5)).toBe(1500);
    expect(focusMinutesToSeconds(99999)).toBe(FOCUS_SESSION_MAX_SECONDS);
  });

  it("开始：running + 生成 sessionId，墙钟推进 elapsed", () => {
    const running = startAt(idle());
    expect(running.phase).toBe("running");
    expect(running.sessionId).toMatch(/^focus-/);
    expect(running.sessionStartedAt).toBeTruthy();
    expect(focusElapsedSecondsAt(running, T0 + 65_000)).toBe(65);
    expect(focusRemainingSecondsAt(running, T0 + 65_000)).toBe(1500 - 65);
  });

  it("暂停冻结时长、恢复继续累计（跨暂停段不计时）", () => {
    const running = startAt(idle());
    const paused = focusSessionReducer(running, { type: "PAUSE", nowMs: T0 + 30_000 });
    expect(paused.phase).toBe("paused");
    // 暂停 10 分钟后仍是 30s
    expect(focusElapsedSecondsAt(paused, T0 + 630_000)).toBe(30);
    const resumed = focusSessionReducer(paused, { type: "RESUME", nowMs: T0 + 630_000 });
    expect(resumed.phase).toBe("running");
    expect(focusElapsedSecondsAt(resumed, T0 + 645_000)).toBe(45);
  });

  it("倒计时到 0 自动 finished，时长冻结在目标值", () => {
    const s = startAt(idle(1));
    const ticked = focusSessionReducer(s, { type: "TICK", nowMs: T0 + 61_000 });
    expect(ticked.phase).toBe("finished");
    expect(isFocusFinishedAt(ticked, T0 + 61_000)).toBe(true);
    expect(focusElapsedSecondsAt(ticked, T0 + 600_000)).toBe(60);
    expect(focusRemainingSecondsAt(ticked, T0 + 600_000)).toBe(0);
  });

  it("手动结束：FINISH 冻结并钳位到目标时长", () => {
    const s = startAt(idle(25));
    const finished = focusSessionReducer(s, { type: "FINISH", nowMs: T0 + 90_000 });
    expect(finished.phase).toBe("finished");
    expect(focusElapsedSecondsAt(finished, T0 + 500_000)).toBe(90);
    // 结束之后再推进也不增长
    expect(focusElapsedSecondsAt(finished, T0 + 9_000_000)).toBe(90);
  });

  it("break：进入休息后 elapsed 不计时，恢复后继续", () => {
    const s = startAt(idle(25));
    const brk = focusSessionReducer(s, { type: "BREAK", nowMs: T0 + 20_000 });
    expect(brk.phase).toBe("break");
    expect(focusElapsedSecondsAt(brk, T0 + 100_000)).toBe(20);
    const back = focusSessionReducer(brk, { type: "RESUME_FROM_BREAK", nowMs: T0 + 100_000 });
    expect(back.phase).toBe("running");
    expect(focusElapsedSecondsAt(back, T0 + 110_000)).toBe(30);
  });

  it("跨刷新恢复：运行中快照按墙钟差补回时长并继续 running", () => {
    const s = startAt(idle(25));
    const snapshot = serializeFocusSession(s, T0 + 120_000, null);
    const raw = JSON.stringify(snapshot);
    // 30s 后刷新（页面重载）
    const restored = restoreFocusSession(raw, { nowMs: T0 + 150_000, mode: "countdown", taskId: null });
    expect(restored).not.toBeNull();
    expect(restored!.phase).toBe("running");
    expect(focusElapsedSecondsAt(restored!, T0 + 150_000)).toBe(150);
    expect(restored!.sessionId).toBe(s.sessionId);
    // 恢复后继续走表
    expect(focusElapsedSecondsAt(restored!, T0 + 180_000)).toBe(180);
  });

  it("恢复异常输入：坏 JSON / 版本或模式或任务不匹配 / 过期 / 时钟回拨 → null", () => {
    const s = startAt(idle(25));
    const raw = JSON.stringify(serializeFocusSession(s, T0, 7));
    expect(restoreFocusSession("not-json", { nowMs: T0, mode: "countdown", taskId: 7 })).toBeNull();
    expect(restoreFocusSession(JSON.stringify({ version: 99 }), { nowMs: T0, mode: "countdown", taskId: 7 })).toBeNull();
    expect(restoreFocusSession(raw, { nowMs: T0, mode: "stopwatch", taskId: 7 })).toBeNull();
    expect(restoreFocusSession(raw, { nowMs: T0, mode: "countdown", taskId: 8 })).toBeNull();
    // 超过单会话上限（12h）视为过期
    expect(restoreFocusSession(raw, { nowMs: T0 + (FOCUS_SESSION_MAX_SECONDS + 60) * 1000, mode: "countdown", taskId: 7 })).toBeNull();
    // 时钟回拨（快照来自未来）不信任
    expect(restoreFocusSession(raw, { nowMs: T0 - 60_000, mode: "countdown", taskId: 7 })).toBeNull();
  });

  it("恢复时把异常数值钳位（负数/超大 elapsed、超长 total）", () => {
    const snap = {
      version: 1,
      mode: "countdown" as const,
      taskId: null,
      phase: "paused" as const,
      totalSeconds: 999_999_999,
      elapsedMs: -50_000,
      segmentStartedAtMs: null,
      sessionId: "focus-x",
      sessionStartedAt: "2026-10-19T12:00:00.000Z",
      updatedAtMs: T0,
    };
    const restored = restoreFocusSession(JSON.stringify(snap), { nowMs: T0 + 1000, mode: "countdown", taskId: null });
    expect(restored).not.toBeNull();
    expect(restored!.totalSeconds).toBe(FOCUS_SESSION_MAX_SECONDS);
    expect(restored!.elapsedMsBase).toBe(0);
  });

  it("SET_MINUTES 重置为暂停态并换目标时长；RESET 回 idle", () => {
    const s = startAt(idle(25));
    const changed = focusSessionReducer(s, { type: "SET_MINUTES", minutes: 45, nowMs: T0 + 10_000 });
    expect(changed.totalSeconds).toBe(2700);
    expect(changed.elapsedMsBase).toBe(0);
    expect(changed.phase).toBe("paused");
    const reset = focusSessionReducer(changed, { type: "RESET", nowMs: T0 + 20_000 });
    expect(reset.phase).toBe("idle");
    expect(reset.totalSeconds).toBe(2700);
    expect(reset.sessionId).toBeNull();
  });

  it("storage 往返：save/load/clear；storage 抛异常也不影响调用方", () => {
    const map = new Map<string, string>();
    const mem: FocusSessionStorage = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
    };
    const key = focusStorageKey("countdown", null);
    const s = startAt(idle(25));
    saveFocusSession(mem, key, s, T0 + 10_000, null);
    const loaded = loadFocusSession(mem, key, { nowMs: T0 + 15_000, mode: "countdown", taskId: null });
    expect(loaded).not.toBeNull();
    expect(focusElapsedSecondsAt(loaded!, T0 + 15_000)).toBe(15);
    clearFocusSession(mem, key);
    expect(loadFocusSession(mem, key, { nowMs: T0 + 15_000, mode: "countdown", taskId: null })).toBeNull();

    const broken: FocusSessionStorage = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => { throw new Error("denied"); },
    };
    expect(() => saveFocusSession(broken, key, s, T0, null)).not.toThrow();
    expect(loadFocusSession(broken, key, { nowMs: T0, mode: "countdown", taskId: null })).toBeNull();
    expect(() => clearFocusSession(broken, key)).not.toThrow();
  });
});
