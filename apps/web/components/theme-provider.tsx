"use client";

import { useEffect, useState } from "react";
import { useUiStore, type UiTheme } from "@/store/ui-store";

/**
 * 主题来源（三处必须一致，改动时同步检查）：
 *
 * 1. `store/ui-store.ts` 的 persist `name`（当前 "lwb-web-ui"）—— 主题真正的持久化位置；
 * 2. `app/layout.tsx` 的 `<head>` 内联防闪脚本 —— 首屏绘制前读同一个 key 预置 `html.dark`；
 * 3. 本文件的 `ThemeProvider` —— 挂载后统一维护 `html.dark`，并跟随 store / 系统偏好变化。
 *
 * provider 运行时直接读 store 的状态，不自己解析 storage；下面导出的 `THEME_STORAGE_KEY`
 * 只作为"防闪脚本 key"的引用常量，供 `lib/theme.test.ts` 断言三处一致（防漂移）。
 */

/** persist 的 localStorage key，仅供测试/文档引用，真实值以 store persist 配置为准。 */
export const THEME_STORAGE_KEY = "lwb-web-ui";

/**
 * 纯函数：主题档位 + 系统是否深色 -> 是否给 `<html>` 加 `dark` 类。
 *
 * - `light`：始终浅色；
 * - `dark`：始终深色；
 * - `auto`：跟随系统（`prefers-color-scheme: dark`）。
 *
 * 抽成纯函数便于单测覆盖三态，组件层只负责订阅变化与写 class。
 */
export function resolveIsDark(theme: UiTheme, systemDark: boolean): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return systemDark;
}

/**
 * 订阅系统深浅色偏好。
 *
 * 初始返回 `null`（未知）：SSR 与首帧不猜系统偏好，避免与防闪脚本预置的 class 打架、
 * 产生一次"先浅后深"的闪动。挂载后立刻取真实值，并随系统切换实时更新。
 */
export function useSystemDark(): boolean | null {
  const [systemDark, setSystemDark] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return systemDark;
}

/**
 * 全局主题提供者（无 UI，返回 null）。
 *
 * 全仓**唯一**的 `document.documentElement.classList.toggle("dark")` 出口：
 * 页面不再各自写 effect（设置页的历史实现已删除），刷新任何页面都保持深色。
 */
export function ThemeProvider() {
  const theme = useUiStore((s) => s.theme);
  const systemDark = useSystemDark();

  useEffect(() => {
    // auto 档在系统偏好尚未读到时不碰 class：沿用 inline 防闪脚本预置的结果，
    // 否则会先移除 dark 再由下一次渲染加回来（浅色闪一下）。
    if (theme === "auto" && systemDark === null) return;
    const root = document.documentElement;
    root.classList.toggle("dark", resolveIsDark(theme, systemDark ?? false));
    // 历史遗留的壁纸亮度开关类由主题统一接管（保持旧行为：永远移除）
    root.classList.remove("bg-dark");
  }, [theme, systemDark]);

  return null;
}
