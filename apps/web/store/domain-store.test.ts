import { describe, it, expect, beforeEach } from "vitest";
import { useDomainStore } from "./domain-store";

beforeEach(() => {
  useDomainStore.setState({ current: null });
});

describe("useDomainStore", () => {
  it("starts with no current domain", () => {
    expect(useDomainStore.getState().current).toBeNull();
  });

  it("sets and updates the current domain identity", () => {
    const setCurrent = useDomainStore.getState().setCurrent;
    setCurrent({
      careerKey: "english-c-abc",
      name: "英语学习",
      color: "#2563eb",
      icon: "languages",
      kindLabel: "语言学习",
      isLocked: false,
    });
    expect(useDomainStore.getState().current).toMatchObject({
      careerKey: "english-c-abc",
      name: "英语学习",
      color: "#2563eb",
    });

    setCurrent({
      careerKey: "ict",
      name: "ICT 学习规划",
      color: "#4f46e5",
      icon: "cpu",
      kindLabel: "职业成长",
      isLocked: false,
    });
    expect(useDomainStore.getState().current?.careerKey).toBe("ict");
  });

  it("can clear the current domain", () => {
    useDomainStore.getState().setCurrent({
      careerKey: "ict",
      name: "ICT 学习规划",
      color: "#4f46e5",
      icon: "cpu",
      kindLabel: "职业成长",
      isLocked: false,
    });
    useDomainStore.getState().setCurrent(null);
    expect(useDomainStore.getState().current).toBeNull();
  });
});
