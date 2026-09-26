import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * B0 · 路由表快照（v17 阶段 B 的安全网）
 *
 * 导航栈重构把 app/ 下的 hub 页移进了 `(tabs)/` 分组、并把次级页从
 * '<Tabs href:null>' 改为根 '<Stack>' 的注册。这次改动**承诺 URL 完全不变** ——
 * 本测试把承诺变成可验证：直接扫描 `src/app` 推导路由集合，与固定清单逐一比对。
 *
 * 迁移前后都应是这 27 条（顺序无关）：
 *   /                                 /dashboard
 *   /today /learn /career /wellness /settings
 *   /jobs /roadmap /tasks /logs /market /radar /applications /resume /resume-preview
 *   /certificates /interview /phase/[id] /account-security /domain-manager
 *   /trackers /sports-card /habits /workout /nutrition /diagnostics
 *
 * 若以后真的要新增/删除页面，改这里即等于显式声明"路由表变了"。
 */
const APP_DIR = path.resolve(__dirname, "..", "app");

const EXPECTED_ROUTES = [
  "/",
  "/account-security",
  "/applications",
  "/career",
  "/certificates",
  "/dashboard",
  "/diagnostics",
  "/domain-manager",
  "/habits",
  "/interview",
  "/jobs",
  "/learn",
  "/logs",
  "/market",
  "/nutrition",
  "/phase/[id]",
  "/radar",
  "/resume",
  "/resume-preview",
  "/roadmap",
  "/settings",
  "/sports-card",
  "/tasks",
  "/today",
  "/trackers",
  "/wellness",
  "/workout",
];

/** 文件相对路径 → 路由路径；返回 null 表示不产生路由（布局文件 / expo 特殊文件） */
function routeOf(relative: string): string | null {
  const segments = relative
    .split(/[\\/]/)
    .filter(Boolean)
    .map((s) => s.replace(/\.(tsx|ts|jsx|js)$/, ""));
  // 括号分组不进 URL；以 + 开头的是 expo-router 特殊文件（+not-found / +html）
  const visible = segments.filter((s) => !/^\(.+\)$/.test(s) && !s.startsWith("+"));
  if (visible.length === 0) return null;
  const last = visible[visible.length - 1];
  if (last.startsWith("_")) return null; // _layout
  const parts = visible.slice();
  if (last === "index") parts.pop();
  const route = "/" + parts.join("/");
  return route === "/" ? "/" : route;
}

function collect(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + "/" + entry.name : entry.name;
    if (entry.isDirectory()) out.push(...collect(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

describe("app 路由表快照（阶段 B 迁移后 URL 未变）", () => {
  it("扫描 src/app 得到的路由集合与固定清单完全一致", () => {
    const actual = collect(APP_DIR)
      .map(routeOf)
      .filter((r): r is string => r !== null)
      .sort();
    // 失败时把两边都打印出来，便于直接对照
    expect(actual, `实际路由：\n${actual.join("\n")}\n\n期望路由：\n${EXPECTED_ROUTES.join("\n")}`).toEqual(
      [...EXPECTED_ROUTES].sort()
    );
  });

  it("hub 页确实在 (tabs) 分组内，子页留在 app 根", () => {
    const hubs = ["today", "learn", "career", "wellness", "settings", "index", "dashboard"];
    for (const h of hubs) {
      expect(fs.existsSync(path.join(APP_DIR, "(tabs)", h + ".tsx")), h + " 应在 (tabs)/ 内").toBe(true);
      expect(fs.existsSync(path.join(APP_DIR, h + ".tsx")), h + " 不应留在 app 根").toBe(false);
    }
    for (const sub of ["tasks", "jobs", "habits", "workout", "nutrition", "diagnostics"]) {
      expect(fs.existsSync(path.join(APP_DIR, sub + ".tsx")), sub + " 应留在 app 根（Stack 的子页）").toBe(true);
    }
  });

  it("(tabs) 分组不产生额外的 URL 片段", () => {
    const routes = collect(APP_DIR)
      .map(routeOf)
      .filter((r): r is string => r !== null);
    expect(routes.some((r) => r.includes("(tabs)"))).toBe(false);
  });
});
