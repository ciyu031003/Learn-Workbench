import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DailyTask, FocusSession, LogEntry, TopicProgress } from "@learn-workbench/shared";
import { todayISO } from "@learn-workbench/shared";

export type TaskType = "study" | "agent" | "output" | "review" | "exam";
export type LogKind = "feynman" | "review" | "project" | "interview";
export type SyncEntityType =
  | "progress"
  | "tasks"
  | "sessions"
  | "checkins"
  | "logs"
  | "github"
  | "customTopics";

export interface SyncChange {
  entityType: SyncEntityType;
  entityId: string; // 稳定 ID：client_id 或自然键（topicId / checkinDate）
  operation: "CREATE" | "UPDATE" | "DELETE";
  version: number;
  payload: Record<string, unknown> | null;
  updatedAt: string;
}

export type PendingChange = SyncChange;

interface LocalTask extends DailyTask {
  clientId?: string;
}
interface LocalLog extends LogEntry {
  clientId?: string;
}
interface LocalSession extends FocusSession {
  clientId?: string;
}

export interface GithubRecord {
  id: number;
  clientId?: string;
  title: string;
  url: string | null;
  content: string | null;
}

export interface CustomTopic {
  id: number;
  clientId?: string;
  phaseId: number;
  title: string;
  summary: string | null;
}

/** 生成跨设备稳定 ID（client_id） */

/** payload 字段类型收窄（payload: Record<string, unknown>） */
const sval = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const nval = (v: unknown, d = 0): number => (typeof v === "number" ? v : Number(v) || d);
const bval = (v: unknown, d = false): boolean => (typeof v === "boolean" ? v : Boolean(v));
const snull = (v: unknown): string | null => (typeof v === "string" ? v : null);
const nnull = (v: unknown): number | null => (typeof v === "number" ? v : v == null ? null : Number(v));

export function uid(): string {
  return "c-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

interface AppState {
  progress: Record<number, TopicProgress>;
  tasks: LocalTask[];
  logs: LocalLog[];
  sessions: LocalSession[];
  checkins: string[];
  backgroundEnabled: boolean;
  token: string | null;
  username: string | null;
  github: GithubRecord[];
  customTopics: CustomTopic[];
  deviceId: string;
  pendingChanges: PendingChange[];
  lastSyncedAt: string | null;

  toggleTopic: (topicId: number) => void;
  addTask: (title: string, taskType: TaskType) => void;
  toggleTaskDone: (id: number) => void;
  addLog: (kind: LogKind, title: string, content: string) => void;
  checkinToday: () => void;
  addSession: (taskId: number | null, seconds: number) => void;
  toggleBackground: () => void;
  resetAll: () => void;

  setAuth: (token: string | null, username: string | null) => void;
  addGithub: (title: string, url: string | null, content: string | null) => void;
  removeGithub: (id: number) => void;
  addCustomTopic: (phaseId: number, title: string, summary: string | null) => void;
  removeCustomTopic: (id: number) => void;

  applyRemoteChanges: (changes: SyncChange[]) => void;
  clearPendingChanges: () => void;
  setLastSyncedAt: (t: string | null) => void;
}

let seq = 1;
const nextId = () => seq++;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      progress: {},
      tasks: [],
      logs: [],
      sessions: [],
      checkins: [],
      backgroundEnabled: true,
      token: null,
      username: null,
      github: [],
      customTopics: [],
      deviceId: uid(),
      pendingChanges: [],
      lastSyncedAt: null,

      toggleTopic: (topicId) =>
        set((s) => {
          const prev = s.progress[topicId];
          const next: TopicProgress = {
            topicId,
            done: !(prev?.done ?? false),
            note: prev?.note ?? null,
            updatedAt: new Date().toISOString(),
          };
          const change: PendingChange = {
            entityType: "progress",
            entityId: String(topicId),
            operation: "UPDATE",
            version: 1,
            payload: { topicId, done: next.done, note: next.note, updatedAt: next.updatedAt },
            updatedAt: next.updatedAt,
          };
          return { progress: { ...s.progress, [topicId]: next }, pendingChanges: [change, ...s.pendingChanges] };
        }),

      addTask: (title, taskType) =>
        set((s) => {
          const now = new Date().toISOString();
          const clientId = uid();
          const task: LocalTask = {
            id: nextId(),
            clientId,
            taskDate: todayISO(),
            title,
            phaseId: null,
            topicId: null,
            taskType,
            done: false,
            focusMinutes: 0,
            sortOrder: s.tasks.length,
          };
          const change: PendingChange = {
            entityType: "tasks",
            entityId: clientId,
            operation: "CREATE",
            version: 1,
            payload: { ...task, updatedAt: now },
            updatedAt: now,
          };
          return { tasks: [...s.tasks, task], pendingChanges: [change, ...s.pendingChanges] };
        }),

      toggleTaskDone: (id) =>
        set((s) => {
          const now = new Date().toISOString();
          let changed: PendingChange | null = null;
          const tasks = s.tasks.map((t) => {
            if (t.id !== id) return t;
            const next = { ...t, done: !t.done };
            changed = {
              entityType: "tasks",
              entityId: next.clientId || "srv-" + next.id,
              operation: "UPDATE",
              version: 1,
              payload: { ...next, updatedAt: now },
              updatedAt: now,
            };
            return next;
          });
          return changed
            ? { tasks, pendingChanges: [changed, ...s.pendingChanges] }
            : { tasks };
        }),

      addLog: (kind, title, content) =>
        set((s) => {
          const now = new Date().toISOString();
          const clientId = uid();
          const log: LocalLog = { id: nextId(), clientId, kind, title, content, createdAt: now, updatedAt: now };
          const change: PendingChange = {
            entityType: "logs",
            entityId: clientId,
            operation: "CREATE",
            version: 1,
            payload: { ...log },
            updatedAt: now,
          };
          return { logs: [log, ...s.logs], pendingChanges: [change, ...s.pendingChanges] };
        }),

      checkinToday: () =>
        set((s) => {
          const date = todayISO();
          if (s.checkins.includes(date)) return s;
          const now = new Date().toISOString();
          const change: PendingChange = {
            entityType: "checkins",
            entityId: date,
            operation: "CREATE",
            version: 1,
            payload: { checkinDate: date, note: null },
            updatedAt: now,
          };
          return { checkins: [...s.checkins, date], pendingChanges: [change, ...s.pendingChanges] };
        }),

      addSession: (taskId, seconds) =>
        set((s) => {
          const now = new Date().toISOString();
          const start = new Date(Date.now() - seconds * 1000).toISOString();
          const clientId = uid();
          const session: LocalSession = {
            id: nextId(),
            clientId,
            taskId,
            startedAt: start,
            endedAt: now,
            durationSeconds: seconds,
            tag: null,
          };
          const changes: PendingChange[] = [
            {
              entityType: "sessions",
              entityId: clientId,
              operation: "CREATE",
              version: 1,
              payload: { ...session },
              updatedAt: now,
            },
          ];
          let tasks = s.tasks;
          if (taskId) {
            tasks = s.tasks.map((t) => {
              if (t.id !== taskId) return t;
              const next = { ...t, focusMinutes: t.focusMinutes + Math.round(seconds / 60) };
              changes.push({
                entityType: "tasks",
                entityId: next.clientId || "srv-" + next.id,
                operation: "UPDATE",
                version: 1,
                payload: { ...next, updatedAt: now },
                updatedAt: now,
              });
              return next;
            });
          }
          return { sessions: [...s.sessions, session], tasks, pendingChanges: [...changes, ...s.pendingChanges] };
        }),

      toggleBackground: () => set((s) => ({ backgroundEnabled: !s.backgroundEnabled })),
      resetAll: () =>
        set({
          progress: {},
          tasks: [],
          logs: [],
          sessions: [],
          checkins: [],
          github: [],
          customTopics: [],
          pendingChanges: [],
          lastSyncedAt: null,
        }),

      setAuth: (token, username) => set({ token, username }),

      addGithub: (title, url, content) =>
        set((s) => {
          const now = new Date().toISOString();
          const clientId = uid();
          const g: GithubRecord = { id: nextId(), clientId, title, url, content };
          const change: PendingChange = {
            entityType: "github",
            entityId: clientId,
            operation: "CREATE",
            version: 1,
            payload: { ...g },
            updatedAt: now,
          };
          return { github: [g, ...s.github], pendingChanges: [change, ...s.pendingChanges] };
        }),

      removeGithub: (id) =>
        set((s) => {
          const g = s.github.find((x) => x.id === id);
          if (!g) return s;
          const now = new Date().toISOString();
          const change: PendingChange = {
            entityType: "github",
            entityId: g.clientId || "srv-" + g.id,
            operation: "DELETE",
            version: 1,
            payload: null,
            updatedAt: now,
          };
          return { github: s.github.filter((x) => x.id !== id), pendingChanges: [change, ...s.pendingChanges] };
        }),

      addCustomTopic: (phaseId, title, summary) =>
        set((s) => {
          const now = new Date().toISOString();
          const clientId = uid();
          const t: CustomTopic = { id: nextId(), clientId, phaseId, title, summary };
          const change: PendingChange = {
            entityType: "customTopics",
            entityId: clientId,
            operation: "CREATE",
            version: 1,
            payload: { ...t },
            updatedAt: now,
          };
          return { customTopics: [...s.customTopics, t], pendingChanges: [change, ...s.pendingChanges] };
        }),

      removeCustomTopic: (id) =>
        set((s) => {
          const t = s.customTopics.find((x) => x.id === id);
          if (!t) return s;
          const now = new Date().toISOString();
          const change: PendingChange = {
            entityType: "customTopics",
            entityId: t.clientId || "srv-" + t.id,
            operation: "DELETE",
            version: 1,
            payload: null,
            updatedAt: now,
          };
          return {
            customTopics: s.customTopics.filter((x) => x.id !== id),
            pendingChanges: [change, ...s.pendingChanges],
          };
        }),

      applyRemoteChanges: (changes) =>
        set((s) => {
          let progress = { ...s.progress };
          let tasks = [...s.tasks];
          let logs = [...s.logs];
          let sessions = [...s.sessions];
          let checkins = [...s.checkins];
          let github = [...s.github];
          let customTopics = [...s.customTopics];

          for (const c of changes) {
            // LWW：本地未推送的更新应获胜
            const local = s.pendingChanges.find(
              (p) => p.entityType === c.entityType && p.entityId === c.entityId
            );
            if (local && new Date(local.updatedAt) > new Date(c.updatedAt)) continue;

            if (c.operation === "DELETE") {
              switch (c.entityType) {
                case "progress": {
                  const t = Number(c.entityId);
                  const rest = { ...progress };
                  delete rest[t];
                  progress = rest;
                  break;
                }
                case "tasks":
                  tasks = tasks.filter((x) => (x.clientId || "srv-" + x.id) !== c.entityId);
                  break;
                case "sessions":
                  sessions = sessions.filter((x) => (x.clientId || "srv-" + x.id) !== c.entityId);
                  break;
                case "checkins":
                  checkins = checkins.filter((d) => d !== c.entityId);
                  break;
                case "logs":
                  logs = logs.filter((x) => (x.clientId || "srv-" + x.id) !== c.entityId);
                  break;
                case "github":
                  github = github.filter((x) => (x.clientId || "srv-" + x.id) !== c.entityId);
                  break;
                case "customTopics":
                  customTopics = customTopics.filter((x) => (x.clientId || "srv-" + x.id) !== c.entityId);
                  break;
              }
              continue;
            }

            const p = c.payload ?? {};
            switch (c.entityType) {
              case "progress": {
                const t = Number(c.entityId);
                progress = {
                  ...progress,
                  [t]: { topicId: t, done: bval(p.done), note: snull(p.note), updatedAt: c.updatedAt },
                };
                break;
              }
              case "tasks": {
                const task: LocalTask = {
                  id: nval(p.id, nextId()),
                  clientId: c.entityId,
                  taskDate: sval(p.taskDate, todayISO()),
                  title: sval(p.title),
                  phaseId: nnull(p.phaseId),
                  topicId: nnull(p.topicId),
                  taskType: (p.taskType as TaskType) ?? "study",
                  done: bval(p.done),
                  focusMinutes: nval(p.focusMinutes),
                  sortOrder: nval(p.sortOrder),
                };
                const idx = tasks.findIndex((x) => (x.clientId || "srv-" + x.id) === c.entityId);
                if (idx >= 0) tasks[idx] = task;
                else tasks = [...tasks, task];
                break;
              }
              case "sessions": {
                const session: LocalSession = {
                  id: nval(p.id, nextId()),
                  clientId: c.entityId,
                  taskId: nnull(p.taskId),
                  startedAt: sval(p.startedAt, new Date().toISOString()),
                  endedAt: snull(p.endedAt),
                  durationSeconds: nval(p.durationSeconds),
                  tag: snull(p.tag),
                };
                const idx = sessions.findIndex((x) => (x.clientId || "srv-" + x.id) === c.entityId);
                if (idx >= 0) sessions[idx] = session;
                else sessions = [...sessions, session];
                break;
              }
              case "checkins": {
                const d = sval(p.checkinDate, c.entityId);
                if (!checkins.includes(d)) checkins = [...checkins, d];
                break;
              }
              case "logs": {
                const log: LocalLog = {
                  id: nval(p.id, nextId()),
                  clientId: c.entityId,
                  kind: (p.kind as LogKind) ?? "review",
                  title: sval(p.title),
                  content: sval(p.content),
                  createdAt: sval(p.createdAt, new Date().toISOString()),
                  updatedAt: sval(p.updatedAt, new Date().toISOString()),
                };
                const idx = logs.findIndex((x) => (x.clientId || "srv-" + x.id) === c.entityId);
                if (idx >= 0) logs[idx] = log;
                else logs = [...logs, log];
                break;
              }
              case "github": {
                const g: GithubRecord = {
                  id: nval(p.id, nextId()),
                  clientId: c.entityId,
                  title: sval(p.title),
                  url: snull(p.url),
                  content: snull(p.content),
                };
                const idx = github.findIndex((x) => (x.clientId || "srv-" + x.id) === c.entityId);
                if (idx >= 0) github[idx] = g;
                else github = [...github, g];
                break;
              }
              case "customTopics": {
                const t: CustomTopic = {
                  id: nval(p.id, nextId()),
                  clientId: c.entityId,
                  phaseId: nval(p.phaseId),
                  title: sval(p.title),
                  summary: snull(p.summary),
                };
                const idx = customTopics.findIndex((x) => (x.clientId || "srv-" + x.id) === c.entityId);
                if (idx >= 0) customTopics[idx] = t;
                else customTopics = [...customTopics, t];
                break;
              }
            }
          }

          return { progress, tasks, logs, sessions, checkins, github, customTopics };
        }),

      clearPendingChanges: () => set({ pendingChanges: [] }),
      setLastSyncedAt: (t) => set({ lastSyncedAt: t }),
    }),
    { name: "lwb-mobile-store", storage: createJSONStorage(() => AsyncStorage) }
  )
);
