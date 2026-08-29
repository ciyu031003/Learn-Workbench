import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useToastStore } from "./toast-store";

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllTimers();
  useToastStore.setState({ toasts: [] });
});

afterEach(() => vi.useRealTimers());

describe("useToastStore", () => {
  it("starts with no toasts", () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("pushes a success toast by default", () => {
    useToastStore.getState().push("已保存");
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ message: "已保存", kind: "success" });
    expect(toasts[0].id).toBeGreaterThan(0);
  });

  it("accepts an explicit kind", () => {
    useToastStore.getState().push("失败", "error");
    const [t] = useToastStore.getState().toasts;
    expect(t.kind).toBe("error");
  });

  it("appends multiple toasts and dismisses by id", () => {
    const { push } = useToastStore.getState();
    push("a");
    push("b");
    const [first, second] = useToastStore.getState().toasts;
    expect(useToastStore.getState().toasts).toHaveLength(2);
    useToastStore.getState().dismiss(first.id);
    const left = useToastStore.getState().toasts;
    expect(left).toHaveLength(1);
    expect(left[0].id).toBe(second.id);
  });

  it("auto-dismisses a toast after the timeout", () => {
    const { push } = useToastStore.getState();
    push("临时");
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(3200);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
