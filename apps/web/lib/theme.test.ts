import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, resolveIsDark } from "../components/theme-provider";

/** 读取仓库内源文件（用于断言"三处 theme key 不漂移"这一跨文件契约）。 */
function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("resolveIsDark", () => {
  it("light 档：无论系统深色与否都保持浅色", () => {
    expect(resolveIsDark("light", false)).toBe(false);
    expect(resolveIsDark("light", true)).toBe(false);
  });

  it("dark 档：无论系统深色与否都保持深色", () => {
    expect(resolveIsDark("dark", false)).toBe(true);
    expect(resolveIsDark("dark", true)).toBe(true);
  });

  it("auto 档：跟随系统偏好", () => {
    expect(resolveIsDark("auto", true)).toBe(true);
    expect(resolveIsDark("auto", false)).toBe(false);
  });
});

describe("主题 localStorage key 跨文件一致性", () => {
  it("store persist name 与布局内联防闪脚本读取的 key 完全一致", () => {
    // layout.tsx 的 inline script 与 store 的 persist name 是两处独立硬编码，
    // 任一改名而漏改另一处 → 刷新回浅色。这里直接校验源文件，防漂移。
    const storeSource = readSource("../store/ui-store.ts");
    const layoutSource = readSource("../app/layout.tsx");
    const persistName = /name:\s*"([^"]+)"/.exec(storeSource)?.[1];
    expect(persistName).toBe(THEME_STORAGE_KEY);
    expect(persistName).toBe("lwb-web-ui");
    expect(layoutSource).toContain(`const THEME_STORAGE_KEY = "${THEME_STORAGE_KEY}"`);
  });

  it("防闪脚本读取 persist 的 state.theme 字段（与 store 初始 state 对齐）", () => {
    const storeSource = readSource("../store/ui-store.ts");
    const layoutSource = readSource("../app/layout.tsx");
    // ui-store 的初始 state 必须带 theme 字段，且枚举三档
    expect(storeSource).toMatch(/theme:\s*"light"/);
    expect(storeSource).toContain('type UiTheme = "light" | "dark" | "auto"');
    // 脚本按 zustand persist 的结构 parsed.state.theme 读取
    expect(layoutSource).toContain("parsed.state.theme");
    expect(layoutSource).toContain("prefers-color-scheme: dark");
  });
});
