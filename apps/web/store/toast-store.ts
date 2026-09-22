import { create } from "zustand";
import { toastLifeMs } from "@/lib/ui-kit";

export interface ToastItem {
  id: number;
  message: string;
  kind: "info" | "success" | "error";
  /** v13：可选副标题（成就/升级类提示用） */
  detail?: string;
  /** 停留时长（ms），与提示条倒计时一致 */
  lifeMs?: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, kind?: ToastItem["kind"], detail?: string) => void;
  dismiss: (id: number) => void;
}

let seq = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = "success", detail) => {
    const id = seq++;
    const lifeMs = toastLifeMs(kind);
    set((s) => ({ toasts: [...s.toasts, { id, message, kind, detail, lifeMs }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), lifeMs);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
