import { create } from "zustand";

export interface DomainIdentity {
  careerKey: string;
  name: string;
  color: string;
  icon: string;
  kindLabel: string;
  isLocked: boolean;
}

interface DomainState {
  current: DomainIdentity | null;
  setCurrent: (d: DomainIdentity | null) => void;
}

export const useDomainStore = create<DomainState>((set) => ({
  current: null,
  setCurrent: (d) => set({ current: d }),
}));
