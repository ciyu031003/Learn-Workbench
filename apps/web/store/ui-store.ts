"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UiTheme = "light" | "dark" | "auto";

interface UiState {
  /** 主题三档：浅色 / 深色 / 跟随系统（auto 走 prefers-color-scheme） */
  theme: UiTheme;
  setTheme: (t: UiTheme) => void;
}

/**
 * persist 迁移（纯函数导出以便测试）：
 * v0 → v1：旧版 theme 只有 light/dark 且不影响壁纸亮度自动逻辑；
 * 升级三档后统一归为 auto（跟随系统），并丢弃已废弃的全站壁纸开关 backgroundEnabled。
 */
export function migrateUiStore(persisted: unknown, version: number): Partial<UiState> {
  if (!persisted || typeof persisted !== "object") return (persisted ?? {}) as Partial<UiState>;
  const raw = persisted as Record<string, unknown> & { theme?: unknown };
  const next: Record<string, unknown> = { ...raw };
  if (version < 1) next.theme = "auto";
  delete next.backgroundEnabled;
  return next as Partial<UiState>;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "lwb-web-ui",
      version: 1,
      migrate: migrateUiStore,
    }
  )
);
