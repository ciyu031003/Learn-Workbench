import { create } from "zustand";

export interface ToastItem {
  id: number;
  message: string;
  kind: "info" | "success" | "error";
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, kind?: ToastItem["kind"]) => void;
  dismiss: (id: number) => void;
}

let seq = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = "success") => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));