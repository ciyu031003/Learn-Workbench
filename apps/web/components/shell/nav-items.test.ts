import { describe, expect, it } from "vitest";
import {
  BOTTOM_TABS,
  CAREER_ITEMS,
  LEARN_GROUPS,
  JOBS_ITEM,
  LEARN_ITEMS,
  NAV,
  SETTINGS_ITEM,
  getNavActiveKey,
  isActivePath,
  navHref,
  resolveDownloadUrl,
} from "./nav-items";

describe("shell 导航常量（S6-6 IA）", () => {
  it("NAV 一级入口：首页 / 我的一天 / 专注（专注独立）", () => {
    expect(NAV.map((item) => item.label)).toEqual(["首页", "我的一天", "专注"]);
    const focus = NAV.find((item) => item.label === "专注");
    expect(navHref(focus!)).toBe("/tasks?focus=1");
  });

  it("学习下拉按三组重建，每组 ≤4 项", () => {
    expect(LEARN_GROUPS.map((g) => g.title)).toEqual(["学习", "健康", "更多"]);
    for (const group of LEARN_GROUPS) {
      expect(group.items.length).toBeGreaterThan(0);
      expect(group.items.length).toBeLessThanOrEqual(4);
      for (const item of group.items) expect(item.href.startsWith("/")).toBe(true);
    }
    // 扁平兼容导出 = 三组顺序拼接
    expect(LEARN_ITEMS).toEqual(LEARN_GROUPS.flatMap((g) => g.items));
  });

  it("深层页都有入口（≤2 次点击可达）", () => {
    const hrefs = new Set([
      ...NAV.map((item) => item.href),
      ...LEARN_ITEMS.map((item) => item.href),
      ...CAREER_ITEMS.map((item) => item.href),
      JOBS_ITEM.href,
      SETTINGS_ITEM.href,
    ]);
    // 学习/健康深层页
    for (const href of [
      "/learn",
      "/roadmap",
      "/tasks",
      "/logs",
      "/wellbeing",
      "/wellbeing/workout",
      "/wellbeing/nutrition",
      "/wellbeing/sports",
      "/habits",
      "/trackers",
      "/settings/content",
    ]) {
      expect(hrefs.has(href), "缺少导航入口：" + href).toBe(true);
    }
    // 职业深层页
    for (const href of ["/career/market", "/career/resume-assets", "/career/interview", "/career/applications"]) {
      expect(hrefs.has(href), "缺少职业入口：" + href).toBe(true);
    }
    // 一级页：首页/我的一天/专注在 NAV，招花/设置在独立常量
    expect(hrefs.has("/dashboard")).toBe(true);
    expect(hrefs.has("/today")).toBe(true);
    expect(hrefs.has("/jobs")).toBe(true);
    expect(hrefs.has("/settings")).toBe(true);
  });

  it("分组内链接不重复（避免同一入口出现两次）", () => {
    const hrefs = LEARN_ITEMS.map((item) => navHref(item));
    expect(new Set(hrefs).size).toBe(hrefs.length);
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

  it("下载地址来自环境变量（未配置/非法 → null，导航隐藏入口）", () => {
    expect(resolveDownloadUrl("https://learn.yuanabd.cn/download.html")).toBe("https://learn.yuanabd.cn/download.html");
    expect(resolveDownloadUrl("  https://x.test/download.html  ")).toBe("https://x.test/download.html");
    expect(resolveDownloadUrl("")).toBeNull();
    expect(resolveDownloadUrl(undefined)).toBeNull();
    expect(resolveDownloadUrl("javascript:alert(1)")).toBeNull();
    expect(resolveDownloadUrl("not a url")).toBeNull();
  });
});

describe("getNavActiveKey", () => {
  it("首页 / 我的一天精确匹配", () => {
    expect(getNavActiveKey("/dashboard")).toBe("dashboard");
    expect(getNavActiveKey("/today")).toBe("today");
    expect(getNavActiveKey("/dashboard/sub")).toBeNull();
  });

  it("学习段覆盖 roadmap / tasks / logs / wellbeing / habits / trackers（含子路径）", () => {
    expect(getNavActiveKey("/roadmap")).toBe("learn");
    expect(getNavActiveKey("/roadmap/x")).toBe("learn");
    expect(getNavActiveKey("/tasks")).toBe("learn");
    expect(getNavActiveKey("/logs/2026-10-19")).toBe("learn");
    expect(getNavActiveKey("/wellbeing")).toBe("learn");
    expect(getNavActiveKey("/wellbeing/nutrition")).toBe("learn");
    expect(getNavActiveKey("/habits")).toBe("learn");
    expect(getNavActiveKey("/trackers")).toBe("learn");
  });

  it("其余一级段各自映射", () => {
    expect(getNavActiveKey("/jobs")).toBe("jobs");
    expect(getNavActiveKey("/jobs/42")).toBe("jobs");
    expect(getNavActiveKey("/career/skills")).toBe("career");
    expect(getNavActiveKey("/settings")).toBe("settings");
    expect(getNavActiveKey("/settings/content")).toBe("settings");
  });

  it("未命中返回 null（不显示滑动胶囊）", () => {
    expect(getNavActiveKey("/")).toBeNull();
    expect(getNavActiveKey("/login")).toBeNull();
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

describe("navHref", () => {
  it("拼接 query 与 hash（顺序：?query#hash）", () => {
    expect(navHref({ href: "/tasks", label: "专", icon: NAV[0].icon, query: "focus=1" })).toBe("/tasks?focus=1");
    expect(navHref({ href: "/tasks", label: "专", icon: NAV[0].icon, hash: "#focus" })).toBe("/tasks#focus");
    const item = { href: "/tasks", label: "x", icon: NAV[0].icon, query: "focus=1", hash: "#focus" };
    expect(navHref(item)).toBe("/tasks?focus=1#focus");
  });
});
