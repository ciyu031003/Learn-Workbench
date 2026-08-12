import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DailyTask, FocusSession, LogEntry, TopicProgress } from "@learn-workbench/shared";
import { todayISO } from "@learn-workbench/shared";

export type TaskType = "study" | "agent" | "output" | "review" | "exam";
export type LogKind = "feynman" | "review" | "project" | "interview";

export interface GithubRecord {
  id: number;
  title: string;
  url: string | null;
  content: string | null;
}

export interface CustomTopic {
  id: number;
  phaseId: number;
  title: string;
  summary: string | null;
}

export interface SyncPayload {
  progress: { topicId: number; done: boolean; note: string | null; updatedAt: string }[];
  tasks: DailyTask[];
  sessions: FocusSession[];
  checkins: { checkinDate: string; note: string | null }[];
  logs: LogEntry[];
  certificates: unknown[];
  github: GithubRecord[];
  customTopics: CustomTopic[];
}

interface AppState {
  progress: Record<number, TopicProgress>;
  tasks: DailyTask[];
  logs: LogEntry[];
  sessions: FocusSession[];
  checkins: string[];
  backgroundEnabled: boolean;
  token: string | null;
  username: string | null;
  github: GithubRecord[];
  customTopics: CustomTopic[];

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
  replaceAll: (data: SyncPayload) => void;
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

      toggleTopic: (topicId) =>
        set((s) => {
          const prev = s.progress[topicId];
          const next: TopicProgress = {
            topicId,
            done: !(prev?.done ?? false),
            note: prev?.note ?? null,
            updatedAt: new Date().toISOString(),
          };
          return { progress: { ...s.progress, [topicId]: next } };
        }),

      addTask: (title, taskType) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              id: nextId(),
              taskDate: todayISO(),
              title,
              phaseId: null,
              topicId: null,
              taskType,
              done: false,
              focusMinutes: 0,
              sortOrder: s.tasks.length,
            },
          ],
        })),

      toggleTaskDone: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        })),

      addLog: (kind, title, content) =>
        set((s) => {
          const now = new Date().toISOString();
          return {
            logs: [{ id: nextId(), kind, title, content, createdAt: now, updatedAt: now }, ...s.logs],
          };
        }),

      checkinToday: () =>
        set((s) => (s.checkins.includes(todayISO()) ? s : { checkins: [...s.checkins, todayISO()] })),

      addSession: (taskId, seconds) =>
        set((s) => {
          const now = new Date().toISOString();
          const start = new Date(Date.now() - seconds * 1000).toISOString();
          const session: FocusSession = {
            id: nextId(),
            taskId,
            startedAt: start,
            endedAt: now,
            durationSeconds: seconds,
            tag: null,
          };
          const tasks = taskId
            ? s.tasks.map((t) =>
                t.id === taskId ? { ...t, focusMinutes: t.focusMinutes + Math.round(seconds / 60) } : t
              )
            : s.tasks;
          return { sessions: [...s.sessions, session], tasks };
        }),

      toggleBackground: () => set((s) => ({ backgroundEnabled: !s.backgroundEnabled })),
      resetAll: () =>
        set({ progress: {}, tasks: [], logs: [], sessions: [], checkins: [], github: [], customTopics: [] }),

      setAuth: (token, username) => set({ token, username }),
      addGithub: (title, url, content) =>
        set((s) => ({ github: [{ id: nextId(), title, url, content }, ...s.github] })),
      removeGithub: (id) => set((s) => ({ github: s.github.filter((g) => g.id !== id) })),
      addCustomTopic: (phaseId, title, summary) =>
        set((s) => ({
          customTopics: [...s.customTopics, { id: nextId(), phaseId, title, summary }],
        })),
      removeCustomTopic: (id) =>
        set((s) => ({ customTopics: s.customTopics.filter((c) => c.id !== id) })),

      replaceAll: (data) =>
        set((s) => {
          const progress: Record<number, TopicProgress> = {};
          for (const p of data.progress ?? []) {
            progress[p.topicId] = {
              topicId: p.topicId,
              done: p.done,
              note: p.note,
              updatedAt: p.updatedAt,
            };
          }
          return {
            progress,
            tasks: data.tasks ?? [],
            sessions: data.sessions ?? [],
            logs: data.logs ?? [],
            checkins: (data.checkins ?? []).map((c) => c.checkinDate),
            github: data.github ?? [],
            customTopics: data.customTopics ?? [],
          };
        }),
    }),
    { name: "lwb-mobile-store", storage: createJSONStorage(() => AsyncStorage) }
  )
);
