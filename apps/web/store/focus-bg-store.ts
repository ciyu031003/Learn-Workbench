"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FocusBgMode = "color" | "upload" | "gallery";

export const FOCUS_COLORS = [
  "#0f172a", "#1f2937", "#111827", "#7c2d12", "#7f1d1d",
  "#14532d", "#1e3a8a", "#4c1d95", "#831843", "#374151",
];

export const FOCUS_GALLERY: { id: string; name: string; css: string }[] = [
  { id: "sunset", name: "黄昏暖阳", css: "linear-gradient(135deg,#ff9a56 0%,#ff6a88 55%,#7b4397 100%)" },
  { id: "ocean", name: "深海蓝", css: "linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)" },
  { id: "forest", name: "森野绿", css: "linear-gradient(135deg,#134e5e 0%,#71b280 100%)" },
  { id: "aurora", name: "极光紫", css: "linear-gradient(135deg,#41295a 0%,#2f0743 100%)" },
  { id: "candy", name: "糖果粉", css: "linear-gradient(135deg,#fbc2eb 0%,#a6c1ee 100%)" },
  { id: "midnight", name: "午夜蓝", css: "linear-gradient(135deg,#000428 0%,#004e92 100%)" },
  { id: "bing", name: "每日 Bing", css: "" },
];

interface FocusBgState {
  mode: FocusBgMode;
  color: string;
  uploadUrl: string | null;
  galleryId: string;
  customQuote: string | null;
  minutes: number;
  setMode: (m: FocusBgMode) => void;
  setColor: (c: string) => void;
  setUploadUrl: (u: string | null) => void;
  setGalleryId: (g: string) => void;
  setCustomQuote: (q: string | null) => void;
  setMinutes: (m: number) => void;
}

export const useFocusBgStore = create<FocusBgState>()(
  persist(
    (set) => ({
      mode: "gallery",
      color: "#0f172a",
      uploadUrl: null,
      galleryId: "bing",
      customQuote: null,
      minutes: 25,
      setMode: (mode) => set({ mode }),
      setColor: (color) => set({ color }),
      setUploadUrl: (uploadUrl) => set({ uploadUrl }),
      setGalleryId: (galleryId) => set({ galleryId }),
      setCustomQuote: (customQuote) => set({ customQuote }),
      setMinutes: (minutes) => set({ minutes }),
    }),
    { name: "lwb-focus-bg" }
  )
);
