import { describe, it, expect } from "vitest";
import { resolveBackTarget, DEFAULT_BACK_TARGET } from "./back-target";

/**
 * 回归护栏：2026-09-15「健康 → 训练记录 → 返回」直接跳回今日首页。
 * 契约：兜底必须回到该页所属 Hub。
 */
describe("resolveBackTarget", () => {
  it("健康域子页回到健康 Hub", () => {
    expect(resolveBackTarget("/workout")).toBe("/wellness");
    expect(resolveBackTarget("/nutrition")).toBe("/wellness");
    expect(resolveBackTarget("/habits")).toBe("/wellness");
  });

  it("职业域子页回到职业 Hub", () => {
    expect(resolveBackTarget("/jobs")).toBe("/career");
    expect(resolveBackTarget("/market")).toBe("/career");
    expect(resolveBackTarget("/radar")).toBe("/career");
    expect(resolveBackTarget("/applications")).toBe("/career");
    expect(resolveBackTarget("/certificates")).toBe("/career");
    expect(resolveBackTarget("/interview")).toBe("/career");
    expect(resolveBackTarget("/career/resume")).toBe("/career");
  });

  it("resume-preview 也回职业（前缀匹配，不被 /resume 截断）", () => {
    expect(resolveBackTarget("/resume-preview")).toBe("/career");
  });

  it("学习域子页回到学习 Hub", () => {
    expect(resolveBackTarget("/roadmap")).toBe("/learn");
    expect(resolveBackTarget("/tasks")).toBe("/learn");
    expect(resolveBackTarget("/logs")).toBe("/learn");
    expect(resolveBackTarget("/trackers")).toBe("/learn");
    expect(resolveBackTarget("/phase/12")).toBe("/learn");
  });

  it("设置域子页回到我的", () => {
    expect(resolveBackTarget("/account-security")).toBe("/settings");
    expect(resolveBackTarget("/domain-manager")).toBe("/settings");
  });

  it("一级 Hub 自身回到今日", () => {
    expect(resolveBackTarget("/wellness")).toBe(DEFAULT_BACK_TARGET);
    expect(resolveBackTarget("/career")).toBe(DEFAULT_BACK_TARGET);
    expect(resolveBackTarget("/learn")).toBe(DEFAULT_BACK_TARGET);
  });

  it("首页别名与空值走默认", () => {
    expect(resolveBackTarget("/")).toBe("/today");
    expect(resolveBackTarget("/dashboard")).toBe("/today");
    expect(resolveBackTarget("/today")).toBe(DEFAULT_BACK_TARGET);
    expect(resolveBackTarget(null)).toBe(DEFAULT_BACK_TARGET);
    expect(resolveBackTarget(undefined)).toBe(DEFAULT_BACK_TARGET);
  });

  it("未知路径走默认", () => {
    expect(resolveBackTarget("/whatever")).toBe(DEFAULT_BACK_TARGET);
  });
});
