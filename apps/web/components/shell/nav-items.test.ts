import { describe, expect, it } from "vitest";
import {
  BOTTOM_TABS,
  CAREER_ITEMS,
  DOWNLOAD_URL,
  LEARN_ITEMS,
  NAV,
  getNavActiveKey,
  isActivePath,
} from "./nav-items";

describe("shell 导航常量", () => {
  it("NAV 是一级入口：首页 / 我的一天", () => {
    expect(NAV.map((item) => item.href)).toEqual(["/dashboard", "/today"]);
    expect(NAV.map((item) => item.label)).toEqual(["首页", "我的一天"]);
  });

  it("LEARN_ITEMS 10 项，href 均以 / 开头，专注入口带 #focus 锚点", () => {
    expect(LEARN_ITEMS).toHaveLength(10);
    for (const item of LEARN_ITEMS) expect(item.href.startsWith("/")).toBe(true);
    const focus = LEARN_ITEMS.find((item) => item.label === "专注");
    expect(focus?.href).toBe("/tasks");
    expect(focus?.hash).toBe("#focus");
  });

  it("CAREER_ITEMS 10 项且 href 不重复", () => {
    expect(CAREER_ITEMS).toHaveLength(10);
    const hrefs = CAREER_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs[0]).toBe("/career");
  });

  it("BOTTOM_TABS 是 5 入口移动底栏", () => {
    expect(BOTTOM_TABS.map((item) => item.href)).toEqual(["/dashboard", "/roadmap", "/jobs", "/career", "/settings"]);
    expect(BOTTOM_TABS.map((item) => item.label)).toEqual(["首页", "学习", "招花", "职业", "我的"]);
  });

  it("所有导航项都有可渲染的 icon（组件函数/对象，非空）", () => {
    for (const item of [...NAV, ...LEARN_ITEMS, ...CAREER_ITEMS, ...BOTTOM_TABS]) {
      expect(item.icon).toBeTruthy();
    }
  });

  it("DOWNLOAD_URL 指向下载页", () => {
    expect(DOWNLOAD_URL.startsWith("https://")).toBe(true);
    expect(DOWNLOAD_URL).toContain("/download.html");
  });
});

describe("getNavActiveKey", () => {
  it("首页 / 我的一天精确匹配", () => {
    expect(getNavActiveKey("/dashboard")).toBe("dashboard");
    expect(getNavActiveKey("/today")).toBe("today");
    expect(getNavActiveKey("/dashboard/sub")).toBeNull();
  });

  it("学习分组覆盖 roadmap / tasks / logs（含子路径）", () => {
    expect(getNavActiveKey("/roadmap")).toBe("learn");
    expect(getNavActiveKey("/roadmap/x")).toBe("learn");
    expect(getNavActiveKey("/tasks")).toBe("learn");
    expect(getNavActiveKey("/logs/2026-10-19")).toBe("learn");
  });

  it("其余一级段各自映射", () => {
    expect(getNavActiveKey("/jobs")).toBe("jobs");
    expect(getNavActiveKey("/jobs/42")).toBe("jobs");
    expect(getNavActiveKey("/career/skills")).toBe("career");
    expect(getNavActiveKey("/settings")).toBe("settings");
  });

  it("未命中返回 null（不显示滑动胶囊）", () => {
    expect(getNavActiveKey("/")).toBeNull();
    expect(getNavActiveKey("/login")).toBeNull();
    expect(getNavActiveKey("/wellbeing")).toBeNull();
    expect(getNavActiveKey("/share/sport/1")).toBeNull();
  });
});

describe("isActivePath", () => {
  it("自身与子路径命中", () => {
    expect(isActivePath("/jobs", "/jobs")).toBe(true);
    expect(isActivePath("/jobs/42", "/jobs")).toBe(true);
  });

  it("同前缀不同段不命中（边界安全）", () => {
    expect(isActivePath("/jobsx", "/jobs")).toBe(false);
    expect(isActivePath("/", "/jobs")).toBe(false);
  });
});
