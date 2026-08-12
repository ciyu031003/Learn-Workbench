"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  theme: "light" | "dark";
  backgroundEnabled: boolean;
  setTheme: (t: "light" | "dark") => void;
  toggleBackground: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "light",
      backgroundEnabled: true,
      setTheme: (theme) => set({ theme }),
      toggleBackground: () => set((s) => ({ backgroundEnabled: !s.backgroundEnabled })),
    }),
    { name: "lwb-web-ui" }
  )
);
