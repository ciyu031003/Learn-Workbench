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

  // v13 U4：toaster 的"剩余时间"细进度条依赖 lifeMs，副标题走 detail
  it("v13：写入 detail 与 lifeMs（成功 3200ms）", () => {
    useToastStore.getState().push("简历已上传", "success", "手机端也能预览");
    const [t] = useToastStore.getState().toasts;
    expect(t.detail).toBe("手机端也能预览");
    expect(t.lifeMs).toBe(3200);
    vi.advanceTimersByTime(3199);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("v13：错误提示停留更久（4200ms）", () => {
    useToastStore.getState().push("上传失败", "error");
    expect(useToastStore.getState().toasts[0].lifeMs).toBe(4200);
    vi.advanceTimersByTime(4200);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
