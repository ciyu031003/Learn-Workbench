import { beforeEach, describe, expect, it } from "vitest";
import {
  initialFocusSessionState,
  useFocusSessionStore,
  type FocusSnapshot,
} from "./focus-session-store";

const snapshot: FocusSnapshot = {
  status: "running",
  remainingSeconds: 1499,
  totalSeconds: 1500,
  timerMode: "countdown",
  taskTitle: "上下文工程",
  sessionMode: "focus",
  updatedAt: 1,
};

beforeEach(() => {
  useFocusSessionStore.setState({ ...initialFocusSessionState });
});

describe("focus-session-store", () => {
  it("opens a new session and bumps sessionKey", () => {
    useFocusSessionStore.getState().openFocus({
      task: { id: 1, title: "上下文工程" },
      autoStart: true,
      initialMinutes: 25,
    });
    const state = useFocusSessionStore.getState();
    expect(state.open).toBe(true);
    expect(state.minimized).toBe(false);
    expect(state.sessionKey).toBe(1);
    expect(state.config?.task).toEqual({ id: 1, title: "上下文工程" });
    expect(state.snapshot).toBeNull();
  });

  it("minimizes without ending the session", () => {
    useFocusSessionStore.getState().openFocus({ task: null });
    useFocusSessionStore.getState().setSnapshot(snapshot);
    useFocusSessionStore.getState().minimize();
    const state = useFocusSessionStore.getState();
    expect(state.open).toBe(true);
    expect(state.minimized).toBe(true);
    expect(state.config).not.toBeNull();
    expect(state.snapshot).toEqual(snapshot);
  });

  it("restores the full screen without remounting", () => {
    useFocusSessionStore.getState().openFocus({ task: null });
    const key = useFocusSessionStore.getState().sessionKey;
    useFocusSessionStore.getState().minimize();
    useFocusSessionStore.getState().restore();
    const state = useFocusSessionStore.getState();
    expect(state.open).toBe(true);
    expect(state.minimized).toBe(false);
    expect(state.sessionKey).toBe(key);
  });

  it("close clears the active session but keeps the key counter", () => {
    useFocusSessionStore.getState().openFocus({ task: null });
    const key = useFocusSessionStore.getState().sessionKey;
    useFocusSessionStore.getState().close();
    const state = useFocusSessionStore.getState();
    expect(state.open).toBe(false);
    expect(state.minimized).toBe(false);
    expect(state.config).toBeNull();
    expect(state.snapshot).toBeNull();
    expect(state.sessionKey).toBe(key);
  });

  it("does not replace an active session", () => {
    useFocusSessionStore.getState().openFocus({ task: { id: 1, title: "A" } });
    const key = useFocusSessionStore.getState().sessionKey;
    useFocusSessionStore.getState().minimize();
    useFocusSessionStore.getState().openFocus({ task: { id: 2, title: "B" } });
    const state = useFocusSessionStore.getState();
    expect(state.config?.task).toEqual({ id: 1, title: "A" });
    expect(state.sessionKey).toBe(key);
    expect(state.minimized).toBe(false);
  });

  it("ignores minimize/restore while closed", () => {
    useFocusSessionStore.getState().minimize();
    useFocusSessionStore.getState().restore();
    expect(useFocusSessionStore.getState().minimized).toBe(false);
  });
});
