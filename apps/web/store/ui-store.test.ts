import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./ui-store";

beforeEach(() => useUiStore.setState({ theme: "light", backgroundEnabled: true }));

describe("useUiStore", () => {
  it("starts with light theme and background enabled", () => {
    const s = useUiStore.getState();
    expect(s.theme).toBe("light");
    expect(s.backgroundEnabled).toBe(true);
  });

  it("sets the theme", () => {
    useUiStore.getState().setTheme("dark");
    expect(useUiStore.getState().theme).toBe("dark");
  });

  it("toggles the background", () => {
    useUiStore.getState().toggleBackground();
    expect(useUiStore.getState().backgroundEnabled).toBe(false);
    useUiStore.getState().toggleBackground();
    expect(useUiStore.getState().backgroundEnabled).toBe(true);
  });
});
