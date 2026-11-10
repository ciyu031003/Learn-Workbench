"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_FOCUS_SCENE_ID, FOCUS_SCENES } from "@learn-workbench/shared/focus-scenes";
import { focusSceneImage } from "@/lib/focus-scene";

export type FocusBgMode = "color" | "upload" | "gallery";

export const FOCUS_COLORS = [
  "#0f172a", "#1f2937", "#111827", "#7c2d12", "#7f1d1d",
  "#14532d", "#1e3a8a", "#4c1d95", "#831843", "#374151",
];

export const FOCUS_GALLERY: { id: string; name: string; css: string; imageUrl: string }[] = [
  ...FOCUS_SCENES.map((scene) => ({
    id: scene.id,
    name: scene.name,
    css: scene.gradient,
    imageUrl: focusSceneImage(scene.id),
  })),
  { id: "bing", name: "每日 Bing", css: "", imageUrl: "" },
];

const FOCUS_SCENE_IDS = new Set(FOCUS_SCENES.map((scene) => scene.id));

/** Map persisted ids from older releases (sunset/ocean/...) onto the current catalog. */
export function normalizeFocusGalleryId(id: string | null | undefined): string {
  if (id === "bing") return id;
  return id && FOCUS_SCENE_IDS.has(id) ? id : DEFAULT_FOCUS_SCENE_ID;
}

interface FocusBgState {
  mode: FocusBgMode;
  color: string;
  uploadUrl: string | null;
  galleryId: string;
  customQuote: string | null;
  minutes: number;
  goal: string;
  musicVolume: number;
  ambientVolume: number;
  setMode: (m: FocusBgMode) => void;
  setColor: (c: string) => void;
  setUploadUrl: (u: string | null) => void;
  setGalleryId: (g: string) => void;
  setCustomQuote: (q: string | null) => void;
  setMinutes: (m: number) => void;
  setGoal: (g: string) => void;
  setMusicVolume: (v: number) => void;
  setAmbientVolume: (v: number) => void;
}

export const useFocusBgStore = create<FocusBgState>()(
  persist(
    (set) => ({
      mode: "gallery",
      color: "#0f172a",
      uploadUrl: null,
      galleryId: DEFAULT_FOCUS_SCENE_ID,
      customQuote: null,
      minutes: 25,
      goal: "",
      musicVolume: 45,
      ambientVolume: 65,
      setMode: (mode) => set({ mode }),
      setColor: (color) => set({ color }),
      setUploadUrl: (uploadUrl) => set({ uploadUrl }),
      setGalleryId: (galleryId) => set({ galleryId }),
      setCustomQuote: (customQuote) => set({ customQuote }),
      setMinutes: (minutes) => set({ minutes }),
      setGoal: (goal) => set({ goal }),
      setMusicVolume: (v) => set({ musicVolume: Math.max(0, Math.min(100, v)) }),
      setAmbientVolume: (v) => set({ ambientVolume: Math.max(0, Math.min(100, v)) }),
    }),
    {
      name: "lwb-focus-bg",
      version: 2,
      migrate: (persisted) => {
        const state = persisted as Partial<FocusBgState>;
        state.galleryId = normalizeFocusGalleryId(state.galleryId);
        return state as FocusBgState;
      },
    }
  )
);
