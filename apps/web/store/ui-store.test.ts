import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore, migrateUiStore } from "./ui-store";

beforeEach(() => useUiStore.setState({ theme: "auto", backgroundEnabled: true }));

describe("useUiStore", () => {
  it("defaults to auto theme and background enabled", () => {
    const s = useUiStore.getState();
    expect(s.theme).toBe("auto");
    expect(s.backgroundEnabled).toBe(true);
  });

  it("sets the theme across all three modes", () => {
    useUiStore.getState().setTheme("dark");
    expect(useUiStore.getState().theme).toBe("dark");
    useUiStore.getState().setTheme("light");
    expect(useUiStore.getState().theme).toBe("light");
    useUiStore.getState().setTheme("auto");
    expect(useUiStore.getState().theme).toBe("auto");
  });

  it("toggles the background", () => {
    useUiStore.getState().toggleBackground();
    expect(useUiStore.getState().backgroundEnabled).toBe(false);
    useUiStore.getState().toggleBackground();
    expect(useUiStore.getState().backgroundEnabled).toBe(true);
  });
});

describe("migrateUiStore (v0 → v1)", () => {
  it("老用户旧版 theme=light/dark 统一归为 auto", () => {
    expect(migrateUiStore({ theme: "light", backgroundEnabled: true }, 0).theme).toBe("auto");
    expect(migrateUiStore({ theme: "dark", backgroundEnabled: false }, 0).theme).toBe("auto");
  });

  it("v0 迁移保留其他字段（如 backgroundEnabled）", () => {
    const migrated = migrateUiStore({ theme: "dark", backgroundEnabled: false }, 0);
    expect(migrated.backgroundEnabled).toBe(false);
  });

  it("version >= 1 的数据原样透传", () => {
    const data = { theme: "dark", backgroundEnabled: true };
    expect(migrateUiStore(data, 1)).toEqual(data);
  });

  it("非对象持久化数据不抛错", () => {
    expect(migrateUiStore(null, 0)).toBeNull();
    expect(migrateUiStore(undefined, 0)).toBeUndefined();
  });
});
