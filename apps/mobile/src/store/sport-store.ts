import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

export type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type SportKind = "basketball" | "badminton" | "walk" | "run" | "cycling" | "swimming";

export interface SportType {
  key: SportKind;
  name: string;
  icon: IoniconName;
  c1: string;
  c2: string;
}

export interface SportRecord {
  id: string;
  kind: SportKind;
  name: string;
  icon: IoniconName;
  minutes: number;
  c1: string;
  c2: string;
  createdAt: string;
}

export const SPORT_TYPES: SportType[] = [
  { key: "basketball", name: "篮球", icon: "basketball", c1: "#F28C28", c2: "#FF8F6B" },
  { key: "badminton", name: "羽毛球", icon: "tennisball", c1: "#8D7BD8", c2: "#B39AD9" },
  { key: "walk", name: "散步", icon: "walk", c1: "#2FB3A6", c2: "#57C7B2" },
  { key: "run", name: "跑步", icon: "fitness", c1: "#F26B5E", c2: "#FFB77A" },
  { key: "cycling", name: "骑行", icon: "bicycle", c1: "#4F8CD6", c2: "#78C2E8" },
  { key: "swimming", name: "游泳", icon: "water", c1: "#2FB3A6", c2: "#5FB7C8" },
];

interface SportState {
  records: SportRecord[];
  addSport: (kind: SportKind, minutes: number) => void;
  removeSport: (id: string) => void;
}

const newId = () => "sp-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

export const useSportStore = create<SportState>()(
  persist(
    (set) => ({
      records: [],
      addSport: (kind, minutes) =>
        set((s) => {
          const t = SPORT_TYPES.find((x) => x.key === kind) ?? SPORT_TYPES[0];
          const record: SportRecord = {
            id: newId(),
            kind,
            name: t.name,
            icon: t.icon,
            minutes: Math.max(5, Math.round(minutes || 15)),
            c1: t.c1,
            c2: t.c2,
            createdAt: new Date().toISOString(),
          };
          return { records: [...s.records, record] };
        }),
      removeSport: (id) => set((s) => ({ records: s.records.filter((r) => r.id !== id) })),
    }),
    { name: "lwb-mobile-sports", storage: createJSONStorage(() => AsyncStorage) }
  )
);
