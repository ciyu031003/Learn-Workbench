import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore, migrateUiStore } from "./ui-store";

beforeEach(() => useUiStore.setState({ theme: "light" }));

describe("useUiStore", () => {
  it("defaults to light theme (油画浅色)", () => {
    const s = useUiStore.getState();
    expect(s.theme).toBe("light");
  });

  it("sets the theme across all three modes", () => {
    useUiStore.getState().setTheme("dark");
    expect(useUiStore.getState().theme).toBe("dark");
    useUiStore.getState().setTheme("light");
    expect(useUiStore.getState().theme).toBe("light");
    useUiStore.getState().setTheme("auto");
    expect(useUiStore.getState().theme).toBe("auto");
  });

});

describe("migrateUiStore (v0 → v1)", () => {
  it("老用户旧版 theme=light/dark 统一归为 auto（跟随系统）", () => {
    expect(migrateUiStore({ theme: "light", backgroundEnabled: true }, 0).theme).toBe("auto");
    expect(migrateUiStore({ theme: "dark", backgroundEnabled: false }, 0).theme).toBe("auto");
  });

  it("v0 迁移丢弃已废弃的 backgroundEnabled", () => {
    const migrated = migrateUiStore({ theme: "dark", backgroundEnabled: false }, 0);
    expect(migrated.theme).toBe("auto");
  });

  it("version >= 1 的数据原样透传", () => {
    const data = { theme: "dark", backgroundEnabled: true };
    expect(migrateUiStore(data, 1)).toEqual({ theme: "dark" });
  });

  it("非对象持久化数据不抛错", () => {
    expect(migrateUiStore(null, 0)).toEqual({});
    expect(migrateUiStore(undefined, 0)).toEqual({});
  });
});
