import { describe, it, expect } from "vitest";
import { resolveBackTarget, DEFAULT_BACK_TARGET, hubOf } from "./back-target";

/**
 * 回归护栏：真机两次反馈「子页返回直接回今日首页」。
 * 契约（2026-09-24 定稿）：**每个模块的子页返回 → 它的上一级**，
 * 一级 Tab 自身没有上一级才回今日；绝不依赖 router.back()（Tab 结构下不可靠）。
 */
describe("resolveBackTarget · 返回上一级", () => {
  it("健康域子页回到健康 Hub", () => {
    expect(resolveBackTarget("/workout")).toBe("/wellness");
    expect(resolveBackTarget("/nutrition")).toBe("/wellness");
    expect(resolveBackTarget("/habits")).toBe("/wellness");
    expect(resolveBackTarget("/sports-card")).toBe("/wellness");
    expect(resolveBackTarget("/trackers")).toBe("/wellness");
    expect(resolveBackTarget("/wellbeing")).toBe("/wellness");
  });

  it("职业域子页回到职业 Hub", () => {
    expect(resolveBackTarget("/jobs")).toBe("/career");
    expect(resolveBackTarget("/market")).toBe("/career");
    expect(resolveBackTarget("/radar")).toBe("/career");
    expect(resolveBackTarget("/applications")).toBe("/career");
    expect(resolveBackTarget("/certificates")).toBe("/career");
    expect(resolveBackTarget("/interview")).toBe("/career");
    expect(resolveBackTarget("/career/resume")).toBe("/career");
    expect(resolveBackTarget("/resume")).toBe("/career");
  });

  it("三级页面回到真正的上一级（不是 Hub）", () => {
    expect(resolveBackTarget("/phase/12")).toBe("/roadmap");
    expect(resolveBackTarget("/resume-preview")).toBe("/resume");
  });

  it("学习域子页回到学习 Hub", () => {
    expect(resolveBackTarget("/roadmap")).toBe("/learn");
    expect(resolveBackTarget("/tasks")).toBe("/learn");
    expect(resolveBackTarget("/logs")).toBe("/learn");
  });

  it("设置域子页回到我的", () => {
    expect(resolveBackTarget("/account-security")).toBe("/settings");
    expect(resolveBackTarget("/domain-manager")).toBe("/settings");
    expect(resolveBackTarget("/diagnostics")).toBe("/settings");
  });

  it("一级 Hub 自身回到今日", () => {
    expect(resolveBackTarget("/wellness")).toBe(DEFAULT_BACK_TARGET);
    expect(resolveBackTarget("/career")).toBe(DEFAULT_BACK_TARGET);
    expect(resolveBackTarget("/learn")).toBe(DEFAULT_BACK_TARGET);
    expect(resolveBackTarget("/settings")).toBe(DEFAULT_BACK_TARGET);
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

describe("hubOf", () => {
  it("Hub 自身返回自身，子页返回所属 Hub", () => {
    expect(hubOf("/career")).toBe("/career");
    expect(hubOf("/jobs")).toBe("/career");
    expect(hubOf("/wellness")).toBe("/wellness");
    expect(hubOf("/nutrition")).toBe("/wellness");
  });
});
