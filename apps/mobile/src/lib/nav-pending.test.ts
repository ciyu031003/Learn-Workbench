import { afterEach, describe, expect, it } from "vitest";

import {
  __resetNavPending,
  setNavPendingParams,
  takeNavPendingParams,
} from "@/lib/nav-pending";

afterEach(() => {
  __resetNavPending();
});

describe("nav-pending（v1.51：同名路由 params 冻结的场外参数通道）", () => {
  it("登记后 take 返回该组参数 —— 目标页据此加载本次目标", () => {
    setNavPendingParams("quiz-408-point", { key: "beokayy-408/co-01-01" });
    expect(takeNavPendingParams("quiz-408-point")).toEqual({
      key: "beokayy-408/co-01-01",
    });
  });

  it("take 即取即清：B 消费后，返回 A 的实例拿不到 B（不会把 A 重载成 B）", () => {
    setNavPendingParams("quiz-read", {
      track: "java-core",
      stage: "stage-1",
      topic: "topic-2",
    });
    expect(takeNavPendingParams("quiz-read")?.topic).toBe("topic-2");
    expect(takeNavPendingParams("quiz-read")).toBeNull();
  });

  it("通道互不串扰", () => {
    setNavPendingParams("quiz-session", { track: "a", mode: "stage" });
    setNavPendingParams("nutrition", { date: "2026-11-01" });
    expect(takeNavPendingParams("quiz-session")).toEqual({
      track: "a",
      mode: "stage",
    });
    expect(takeNavPendingParams("nutrition")).toEqual({ date: "2026-11-01" });
    expect(takeNavPendingParams("quiz-chapter")).toBeNull();
  });

  it("连续登记只保留最后一次 —— 对应快速连点两个目标的场景", () => {
    setNavPendingParams("quiz-408-point", { key: "beokayy-408/ds-01-01" });
    setNavPendingParams("quiz-408-point", { key: "beokayy-408/cn-01-01" });
    expect(takeNavPendingParams("quiz-408-point")?.key).toBe(
      "beokayy-408/cn-01-01",
    );
    expect(takeNavPendingParams("quiz-408-point")).toBeNull();
  });

  it("空登记 {} 是有效状态（无参推送覆盖残留旧参数），与未登记 null 可区分", () => {
    setNavPendingParams("workout-add", { id: "5" });
    setNavPendingParams("workout-add", {});
    // {} 表示"本次无参数"（新建），消费方据此回落到空表单而不是上次的编辑 id
    expect(takeNavPendingParams("workout-add")).toEqual({});
    expect(takeNavPendingParams("workout-add")).toBeNull();
  });

  it("未登记时 take 返回 null —— 深链/状态恢复场景回落到路由 params", () => {
    expect(takeNavPendingParams("nutrition")).toBeNull();
  });
});
