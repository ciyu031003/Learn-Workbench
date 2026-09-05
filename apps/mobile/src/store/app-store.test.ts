import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

import { useAppStore, type SyncChange } from "./app-store";

const change = (partial: Partial<SyncChange> & { entityType: SyncChange["entityType"]; entityId: string }): SyncChange => ({
  operation: "UPDATE",
  version: 1,
  payload: null,
  updatedAt: "2026-08-13T10:00:00.000Z",
  ...partial,
});

beforeEach(() => {
  useAppStore.getState().resetAll();
});

describe("local mutations queue pending changes", () => {
  it("toggleTopic flips progress and enqueues an UPDATE", () => {
    const s = useAppStore.getState();
    s.toggleTopic(42);
    const after = useAppStore.getState();
    expect(after.progress[42]).toMatchObject({ topicId: 42, done: true });
    expect(after.pendingChanges[0]).toMatchObject({
      entityType: "progress",
      entityId: "42",
      operation: "UPDATE",
      payload: { topicId: 42, done: true },
    });
    useAppStore.getState().toggleTopic(42);
    expect(useAppStore.getState().progress[42].done).toBe(false);
  });

  it("addTask enqueues CREATE and toggleTaskDone enqueues UPDATE", () => {
    useAppStore.getState().addTask("学 React", "study");
    const s = useAppStore.getState();
    const task = s.tasks[0];
    expect(task.clientId).toBeTruthy();
    expect(task.title).toBe("学 React");
    expect(s.pendingChanges[0]).toMatchObject({ entityType: "tasks", operation: "CREATE", entityId: task.clientId });

    useAppStore.getState().toggleTaskDone(task.id);
    const after = useAppStore.getState();
    expect(after.tasks[0].done).toBe(true);
    expect(after.pendingChanges[0]).toMatchObject({
      entityType: "tasks",
      entityId: task.clientId,
      operation: "UPDATE",
      payload: expect.objectContaining({ done: true }),
    });
  });

  it("checkinToday is idempotent", () => {
    useAppStore.getState().checkinToday();
    const after1 = useAppStore.getState();
    expect(after1.checkins).toHaveLength(1);
    const firstChange = after1.pendingChanges.length;
    useAppStore.getState().checkinToday();
    expect(useAppStore.getState().checkins).toHaveLength(1);
    expect(useAppStore.getState().pendingChanges.length).toBe(firstChange);
  });

  it("addSession enqueues a session and bumps the task focusMinutes", () => {
    useAppStore.getState().addTask("专注", "study");
    const task = useAppStore.getState().tasks[0];
    useAppStore.getState().addSession(task.id, 1500);
    const s = useAppStore.getState();
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0].durationSeconds).toBe(1500);
    expect(s.tasks[0].focusMinutes).toBe(25);
    expect(s.pendingChanges.some((c) => c.entityType === "sessions")).toBe(true);
    expect(s.pendingChanges.some((c) => c.entityType === "tasks" && c.payload?.focusMinutes === 25)).toBe(true);
  });

  it("addGithub/removeGithub and addCustomTopic/removeCustomTopic enqueue changes", () => {
    useAppStore.getState().addGithub("repo", "https://x", "c");
    const g = useAppStore.getState().github[0];
    expect(useAppStore.getState().pendingChanges[0]).toMatchObject({ entityType: "github", operation: "CREATE" });
    useAppStore.getState().removeGithub(g.id);
    expect(useAppStore.getState().pendingChanges[0]).toMatchObject({ entityType: "github", operation: "DELETE" });

    useAppStore.getState().addCustomTopic(1, "自定义", null);
    const t = useAppStore.getState().customTopics[0];
    expect(useAppStore.getState().pendingChanges[0]).toMatchObject({ entityType: "customTopics", operation: "CREATE" });
    useAppStore.getState().removeCustomTopic(t.id);
    expect(useAppStore.getState().pendingChanges[0]).toMatchObject({ entityType: "customTopics", operation: "DELETE" });
  });
});

describe("applyRemoteChanges", () => {
  it("upserts progress, tasks, sessions, logs, github, customTopics and checkins", () => {
    const s = useAppStore.getState();
    s.addTask("旧任务", "study");
    const existing = useAppStore.getState().tasks[0];
    useAppStore.getState().clearPendingChanges();

    useAppStore.getState().applyRemoteChanges([
      change({ entityType: "progress", entityId: "7", payload: { topicId: 7, done: true, note: "n", updatedAt: "2026-08-13T10:00:00.000Z" } }),
      change({ entityType: "tasks", entityId: existing.clientId!, payload: { id: 999, taskDate: "2026-08-13", title: "远端更新", phaseId: null, topicId: null, taskType: "review", done: true, focusMinutes: 10, sortOrder: 0 } }),
      change({ entityType: "tasks", entityId: "c-new", payload: { taskDate: "2026-08-13", title: "新任务", phaseId: null, topicId: null, taskType: "study", done: false, focusMinutes: 0, sortOrder: 1 } }),
      change({ entityType: "sessions", entityId: "c-s1", payload: { startedAt: "2026-08-13T09:00:00.000Z", endedAt: null, durationSeconds: 900, tag: null } }),
      change({ entityType: "checkins", entityId: "2026-08-13", payload: { checkinDate: "2026-08-13", note: null } }),
      change({ entityType: "logs", entityId: "c-l1", payload: { kind: "review", title: "周复盘", content: "内容", createdAt: "2026-08-13T09:00:00.000Z", updatedAt: "2026-08-13T09:00:00.000Z" } }),
      change({ entityType: "github", entityId: "c-g1", payload: { title: "GH", url: "u", content: "c" } }),
      change({ entityType: "customTopics", entityId: "c-t1", payload: { phaseId: 1, title: "CT", summary: null } }),
    ]);

    const after = useAppStore.getState();
    expect(after.progress[7]).toMatchObject({ topicId: 7, done: true, note: "n" });
    expect(after.tasks).toHaveLength(2);
    expect(after.tasks.find((t) => t.clientId === existing.clientId)).toMatchObject({ title: "远端更新", taskType: "review", done: true, focusMinutes: 10 });
    expect(after.tasks.some((t) => t.clientId === "c-new" && t.title === "新任务")).toBe(true);
    expect(after.sessions[0]).toMatchObject({ clientId: "c-s1", durationSeconds: 900 });
    expect(after.checkins).toContain("2026-08-13");
    expect(after.logs[0]).toMatchObject({ clientId: "c-l1", kind: "review", title: "周复盘" });
    expect(after.github[0]).toMatchObject({ clientId: "c-g1", title: "GH" });
    expect(after.customTopics[0]).toMatchObject({ clientId: "c-t1", phaseId: 1, title: "CT" });
  });

  it("applies DELETE for every entity type using clientId or srv- fallback", () => {
    useAppStore.setState({
      progress: { 3: { topicId: 3, done: true, note: null, updatedAt: "x" } },
      tasks: [
        { id: 1, clientId: "c-1", taskDate: "2026-08-13", title: "a", phaseId: null, topicId: null, taskType: "study", careerKey: "ict", done: false, focusMinutes: 0, sortOrder: 0 },
        { id: 2, taskDate: "2026-08-13", title: "srv", phaseId: null, topicId: null, taskType: "study", careerKey: "ict", done: false, focusMinutes: 0, sortOrder: 1 },
      ],
      sessions: [{ id: 9, clientId: "c-9", taskId: null, startedAt: "x", endedAt: null, durationSeconds: 0, tag: null }],
      checkins: ["2026-08-12"],
      logs: [{ id: 4, clientId: "c-4", kind: "review", title: "l", content: "", createdAt: "x", updatedAt: "x" }],
      github: [{ id: 5, clientId: "c-5", title: "g", url: null, content: null }],
      customTopics: [{ id: 6, clientId: "c-6", phaseId: 1, title: "t", summary: null }],
    });

    useAppStore.getState().applyRemoteChanges([
      change({ entityType: "progress", entityId: "3", operation: "DELETE" }),
      change({ entityType: "tasks", entityId: "c-1", operation: "DELETE" }),
      change({ entityType: "tasks", entityId: "srv-2", operation: "DELETE" }),
      change({ entityType: "sessions", entityId: "c-9", operation: "DELETE" }),
      change({ entityType: "checkins", entityId: "2026-08-12", operation: "DELETE" }),
      change({ entityType: "logs", entityId: "c-4", operation: "DELETE" }),
      change({ entityType: "github", entityId: "c-5", operation: "DELETE" }),
      change({ entityType: "customTopics", entityId: "c-6", operation: "DELETE" }),
    ]);

    const after = useAppStore.getState();
    expect(after.progress[3]).toBeUndefined();
    expect(after.tasks).toEqual([]);
    expect(after.sessions).toEqual([]);
    expect(after.checkins).toEqual([]);
    expect(after.logs).toEqual([]);
    expect(after.github).toEqual([]);
    expect(after.customTopics).toEqual([]);
  });

  it("lets newer local pending changes win (LWW)", () => {
    const localPending: SyncChange = change({
      entityType: "progress",
      entityId: "1",
      updatedAt: "2026-08-13T11:00:00.000Z",
      payload: { topicId: 1, done: true, note: null },
    });
    useAppStore.setState({ pendingChanges: [localPending] });

    // remote is older -> skipped
    useAppStore.getState().applyRemoteChanges([
      change({ entityType: "progress", entityId: "1", updatedAt: "2026-08-13T09:00:00.000Z", payload: { topicId: 1, done: false, note: "old" } }),
    ]);
    expect(useAppStore.getState().progress[1]).toBeUndefined();

    // remote is newer -> applied
    useAppStore.getState().applyRemoteChanges([
      change({ entityType: "progress", entityId: "1", updatedAt: "2026-08-13T12:00:00.000Z", payload: { topicId: 1, done: false, note: "new" } }),
    ]);
    expect(useAppStore.getState().progress[1]).toMatchObject({ done: false, note: "new" });
  });
});

describe("clearPendingChanges / setLastSyncedAt / resetAll", () => {
  it("clears pending changes", () => {
    useAppStore.getState().toggleTopic(1);
    expect(useAppStore.getState().pendingChanges.length).toBeGreaterThan(0);
    useAppStore.getState().clearPendingChanges();
    expect(useAppStore.getState().pendingChanges).toEqual([]);
  });

  it("sets lastSyncedAt", () => {
    useAppStore.getState().setLastSyncedAt("2026-08-13T10:00:00.000Z");
    expect(useAppStore.getState().lastSyncedAt).toBe("2026-08-13T10:00:00.000Z");
  });
});

describe("B5 幂等键", () => {
  it("每条 pending change 携带稳定且唯一的 changeId", () => {
    const s = useAppStore.getState();
    s.addTask("任务一", "study");
    s.addTask("任务二", "study");
    const changes = useAppStore.getState().pendingChanges;
    expect(changes).toHaveLength(2);
    expect(changes[0].changeId).toBeTruthy();
    expect(changes[1].changeId).toBeTruthy();
    expect(changes[0].changeId).not.toBe(changes[1].changeId);
  });
});
