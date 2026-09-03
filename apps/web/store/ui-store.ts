"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UiTheme = "light" | "dark" | "auto";

interface UiState {
  /** 主题三档：浅色 / 深色 / 跟随壁纸（auto，默认，走壁纸亮度自动判定） */
  theme: UiTheme;
  backgroundEnabled: boolean;
  setTheme: (t: UiTheme) => void;
  toggleBackground: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "auto",
      backgroundEnabled: true,
      setTheme: (theme) => set({ theme }),
      toggleBackground: () => set((s) => ({ backgroundEnabled: !s.backgroundEnabled })),
    }),
    {
      name: "lwb-web-ui",
      version: 1,
      migrate: (persisted, version) => {
        // v0 → v1：旧版 theme 只有 light/dark 且不影响壁纸亮度自动逻辑；
        // 升级三档后统一归为 auto，保持升级前视觉行为不变
        if (version < 1 && persisted && typeof persisted === "object") {
          return { ...(persisted as object), theme: "auto" } as UiState;
        }
        return persisted as UiState;
      },
    }
  )
);
