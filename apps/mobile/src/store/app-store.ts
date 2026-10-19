import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DailyTask, FocusSession, LogEntry, TopicProgress, ExerciseType } from "@learn-workbench/shared/schemas";
import { todayISO, fromDateKey } from "@learn-workbench/shared/dates";
import { sportItemByKey } from "@learn-workbench/shared/pure";
import { SPORT_CATALOG } from "@learn-workbench/shared/labels";
import type { ThemeMode } from "@/theme/tokens";
import { secureToken } from "@/lib/secure-token";
import { normalizePendingQueue } from "@/lib/persist-core";
import { createSplitStorage, reportRehydrate } from "@/lib/persist";

export type TaskType = "study" | "agent" | "output" | "review" | "exam";
export type LogKind = "feynman" | "review" | "project" | "interview";
export type SyncEntityType =
  | "progress"
  | "tasks"
  | "sessions"
  | "checkins"
  | "logs"
  | "github"
  | "customTopics"
  | "exerciseLogs"
  | "habits"
  | "habitLogs";

export interface SyncChange {
  entityType: SyncEntityType;
  entityId: string; // 稳定 ID：client_id 或自然键（topicId / checkinDate）
  operation: "CREATE" | "UPDATE" | "DELETE";
  version: number;
  payload: Record<string, unknown> | null;
  updatedAt: string;
  changeId?: string; // B5 幂等键：创建变更时生成，重试推送按 (user_id, change_id) 去重
  /**
   * 写入这条变更时的登录账号（= ownerUserId，取 username）。
   * 换账号保护：A 的离线队列在 B 登录后必须被丢弃，绝不能拿 B 的 Bearer 推上去。
   * 未登录时写入为 null（匿名 -> 登录后归当前账号，属于正常晋升，不丢）。
   */
  ownerUserId?: string | null;
}

export type PendingChange = SyncChange;

interface LocalTask extends DailyTask {
  clientId?: string;
  careerKey: string;
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

/** 运动记录（对齐 SPORT_CATALOG；经 /api/sync 以 exerciseLogs 实体入库 exercise_logs） */
export interface LocalSportLog {
  id: number;
  clientId: string;
  sportKey: string;
  name: string;
  type: ExerciseType;
  minutes: number;
  createdAt: string;
}

/**
 * 本地习惯（S5-3 applier 目标）：字段对齐服务端 habits 表 / Web 端，
 * 多一个 clientId 作为跨设备稳定寻址（习惯打卡 entityId = `<habitClientId>|<YYYY-MM-DD>`）。
 */
export interface LocalHabit {
  id: number;
  clientId?: string;
  name: string;
  icon: string | null;
  isBoolean: boolean;
  targetValue: number | null;
  unit: string | null;
  schedule: number[];
  color: string;
  sortOrder: number;
  updatedAt?: string;
}

/** 本地习惯打卡（habitLogs 实体；自然键 = 习惯 clientId + 日期） */
export interface LocalHabitLog {
  entityId: string; // <habitClientId>|<YYYY-MM-DD>
  habitClientId: string;
  logDate: string;
  value: number;
  note: string | null;
  updatedAt: string;
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
  /** 当前登录账号的归属标识（取 username；未登录/无法判定为 null）。用于 pendingChanges 打标 + 换账号清空旧发件箱（S1-6） */
  ownerUserId: string | null;
  github: GithubRecord[];
  customTopics: CustomTopic[];
  sports: LocalSportLog[];
  /** S5-3：远端习惯 / 打卡（pull 落库；离线时页面可回落本机数据） */
  habits: LocalHabit[];
  habitLogs: LocalHabitLog[];
  deviceId: string;
  apiUrl: string | null;
  pendingChanges: PendingChange[];
  lastSyncedAt: string | null;
  /** AI 每日建议（按日缓存；未拉到/未登录为 null，前端回落规则版） */
  aiTip: { date: string; text: string } | null;
  /**
   * 边缘横滑切换 Tab：`null` = 跟随平台默认（iOS 开、Android 关）。
   * Android 默认关：系统返回手势本身就占用屏幕左右边缘，再叠加我们自己的
   * 26pt 手势条会互相抢触摸；部分国产 ROM 上更是"看得见点不着"的诱因。
   * 解析见 `src/lib/edge-swipe.ts`（store 不直接依赖 react-native，保证单测可加载）。
   */
  edgeSwipeEnabled: boolean | null;

  toggleTopic: (topicId: number) => void;
  addTask: (title: string, taskType: TaskType) => void;
  toggleTaskDone: (id: number) => void;
  addLog: (kind: LogKind, title: string, content: string) => void;
  checkinToday: () => void;
  /** v5 P2-1：label = 本次学习的内容名（写进 focus_sessions.tag；空/未传 = 自由专注） */
  addSession: (taskId: number | null, seconds: number, label?: string | null) => void;
  toggleBackground: () => void;
  setEdgeSwipeEnabled: (enabled: boolean) => void;
  /** 清空本机业务数据（保留登录态与偏好）：设置页「清空本机数据」用 */
  resetAll: () => void;
  /**
   * 退出登录 / 换账号：清业务数据 + 待同步发件箱 + 安全存储 token，
   * 保留 themeMode / deviceId / edgeSwipeEnabled / backgroundEnabled / apiUrl 等偏好。
   * 与 resetAll 分工：resetAll 只清业务数据、不动登录态；注销场景先 resetAll 再 resetForLogout。
   */
  resetForLogout: () => void;

  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;

  setAuth: (token: string | null, username: string | null) => void;
  setApiUrl: (url: string) => void;
  addGithub: (title: string, url: string | null, content: string | null) => void;
  removeGithub: (id: number) => void;
  addCustomTopic: (phaseId: number, title: string, summary: string | null) => void;
  removeCustomTopic: (id: number) => void;
  addSport: (sportKey: string, minutes: number) => void;
  /** v4 P2：按秒记录运动（正向计时结束），避免 45 秒被取整成 1 分钟 */
  addSportSeconds: (sportKey: string, seconds: number) => void;
  /**
   * v1.45：**补录任意日期**的运动（趋势页「补录」入口）。
   * `addSport` / `addSportSeconds` 都把 `createdAt` 钉死在 `now()`，语义不改；
   * 这里接收 `dateISO`（YYYY-MM-DD）并归到当天**本地正午**写入，
   * 避免 UTC 偏移把记录挤到前后一天。
   */
  addSportAt: (sportKey: string, minutes: number, dateISO: string) => void;
  removeSport: (clientId: string) => void;
  importLegacySports: (records: { sportKey: string; minutes: number; createdAt: string }[]) => void;

  applyRemoteChanges: (changes: SyncChange[]) => void;
  /** 清空推送队列；传入本批已成功推送的变更时按引用/幂等键精确移除（分批推送用） */
  clearPendingChanges: (sent?: PendingChange[]) => void;
  setLastSyncedAt: (t: string | null) => void;
  setAiTip: (text: string) => void;
}

let seq = 1;
const nextId = () => seq++;

export const useAppStore = create<AppState>()(
  persist(
    (rawSet) => {
      /**
       * 统一收口（S5-6）：任何一次会写 pendingChanges 的 set 都先做归一化
       * （同实体只留最新 + 上限 2000 条；队列首=最新，超限丢最旧），
       * 避免离线队列无限膨胀、同一实体重复推送。
       */
      const set = ((partial: any, replace?: any) =>
        rawSet((state: AppState) => {
          const next = typeof partial === "function" ? partial(state) : partial;
          if (next && typeof next === "object" && Array.isArray(next.pendingChanges)) {
            return { ...next, pendingChanges: normalizePendingQueue(next.pendingChanges as PendingChange[]) };
          }
          return next;
        }, replace)) as typeof rawSet;
      return ({
      progress: {},
      tasks: [],
      logs: [],
      sessions: [],
      checkins: [],
      backgroundEnabled: true,
      themeMode: "system" as ThemeMode,
      token: null,
      username: null,
      ownerUserId: null,
      github: [],
      customTopics: [],
      sports: [],
      habits: [],
      habitLogs: [],
      deviceId: uid(),
      apiUrl: null,
      pendingChanges: [],
      lastSyncedAt: null,
      aiTip: null,
      // null = 跟随平台默认（iOS 开 / Android 关），用户手动开关后才写入显式值
      edgeSwipeEnabled: null,

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
            changeId: uid(),
            ownerUserId: s.ownerUserId,
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
            careerKey: "ict",
            done: false,
            focusMinutes: 0,
            sortOrder: s.tasks.length,
          };
          const change: PendingChange = {
            changeId: uid(),
            ownerUserId: s.ownerUserId,
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
              changeId: uid(),
              ownerUserId: s.ownerUserId,
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
            changeId: uid(),
            ownerUserId: s.ownerUserId,
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
            changeId: uid(),
            ownerUserId: s.ownerUserId,
            entityType: "checkins",
            entityId: date,
            operation: "CREATE",
            version: 1,
            payload: { checkinDate: date, note: null },
            updatedAt: now,
          };
          return { checkins: [...s.checkins, date], pendingChanges: [change, ...s.pendingChanges] };
        }),

      addSession: (taskId, seconds, label) =>
        set((s) => {
          const now = new Date().toISOString();
          const start = new Date(Date.now() - seconds * 1000).toISOString();
          const clientId = uid();
          // v5 P2-1：学习内容只写 tag（该列与同步链路早已打通：schema/白名单/shared 都已含 tag）
          const tag = label?.trim() ? label.trim().slice(0, 40) : null;
          const session: LocalSession = {
            id: nextId(),
            clientId,
            taskId,
            startedAt: start,
            endedAt: now,
            durationSeconds: seconds,
            tag,
          };
          const changes: PendingChange[] = [
            {
              changeId: uid(),
              ownerUserId: s.ownerUserId,
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
                ownerUserId: s.ownerUserId,
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
      setEdgeSwipeEnabled: (enabled) => set({ edgeSwipeEnabled: enabled }),
      setThemeMode: (mode) => set({ themeMode: mode }),
      resetAll: () =>
        set({
          progress: {},
          tasks: [],
          logs: [],
          sessions: [],
          checkins: [],
          github: [],
          customTopics: [],
          sports: [],
          habits: [],
          habitLogs: [],
          pendingChanges: [],
          lastSyncedAt: null,
        }),

      resetForLogout: () => {
        // 安全存储里的 token 必须同步清掉，否则下次启动 _layout 会用它把会话恢复回来
        void secureToken.clear();
        // 业务数据 + 发件箱全清；偏好（themeMode/deviceId/edgeSwipe/background/apiUrl）保留
        set({
          progress: {},
          tasks: [],
          logs: [],
          sessions: [],
          checkins: [],
          github: [],
          customTopics: [],
          sports: [],
          habits: [],
          habitLogs: [],
          pendingChanges: [],
          lastSyncedAt: null,
          aiTip: null,
          token: null,
          username: null,
          ownerUserId: null,
        });
      },

      setAuth: (token, username) => {
        if (token) void secureToken.save(token);
        else void secureToken.clear();
        set({
          token,
          username,
          // 登录成功写入归属、登出清空。换账号时旧队列按 ownerUserId 丢弃（见 selectForeignPendingChanges）
          ownerUserId: token ? (username?.trim() || null) : null,
        });
      },
      setApiUrl: (url) => set({ apiUrl: url }),

      addGithub: (title, url, content) =>
        set((s) => {
          const now = new Date().toISOString();
          const clientId = uid();
          const g: GithubRecord = { id: nextId(), clientId, title, url, content };
          const change: PendingChange = {
            changeId: uid(),
            ownerUserId: s.ownerUserId,
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
            changeId: uid(),
            ownerUserId: s.ownerUserId,
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
            changeId: uid(),
            ownerUserId: s.ownerUserId,
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
            changeId: uid(),
            ownerUserId: s.ownerUserId,
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

      addSport: (sportKey, minutes) =>
        set((s) => {
          const item = sportItemByKey(sportKey);
          if (!item) return s;
          const now = new Date().toISOString();
          const clientId = uid();
          const mins = Math.max(1, Math.min(600, Math.round(minutes || item.defaultMinutes)));
          const rec: LocalSportLog = {
            id: nextId(),
            clientId,
            sportKey: item.key,
            name: item.name,
            type: item.type,
            minutes: mins,
            createdAt: now,
          };
          const change: PendingChange = {
            changeId: uid(),
            ownerUserId: s.ownerUserId,
            entityType: "exerciseLogs",
            entityId: clientId,
            operation: "CREATE",
            version: 1,
            payload: {
              clientId,
              type: item.type,
              typeLabel: item.name,
              durationSeconds: mins * 60,
              source: "MANUAL",
              startedAt: now,
            },
            updatedAt: now,
          };
          return { sports: [...s.sports, rec], pendingChanges: [change, ...s.pendingChanges] };
        }),

      /**
       * v4 P2：按**秒**记录运动（正向计时/倒计时结束后调用）。
       * 既有 addSport 只吃分钟整数（`Math.round`），45 秒会被抹成 0 → 兜成 1 分钟，数据失真。
       * 同步载荷仍写 `durationSeconds`，本地展示用分钟（向上取整到 1 分钟，避免 0 分钟显示）。
       */
      addSportSeconds: (sportKey, seconds) =>
        set((s) => {
          const item = sportItemByKey(sportKey);
          if (!item) return s;
          const sec = Math.max(1, Math.min(24 * 3600, Math.round(seconds || 0)));
          const now = new Date().toISOString();
          const clientId = uid();
          const rec: LocalSportLog = {
            id: nextId(),
            clientId,
            sportKey: item.key,
            name: item.name,
            type: item.type,
            minutes: Math.max(1, Math.round(sec / 60)),
            createdAt: now,
          };
          const change: PendingChange = {
            changeId: uid(),
            ownerUserId: s.ownerUserId,
            entityType: "exerciseLogs",
            entityId: clientId,
            operation: "CREATE",
            version: 1,
            payload: {
              clientId,
              type: item.type,
              typeLabel: item.name,
              durationSeconds: sec,
              source: "MANUAL",
              startedAt: now,
            },
            updatedAt: now,
          };
          return { sports: [...s.sports, rec], pendingChanges: [change, ...s.pendingChanges] };
        }),

      /**
       * v1.45：补录**指定日期**的运动。
       *
       * 与 `addSport` 的差异只有"日期从哪来"：这里用传入的 `dateISO` 归到本地正午，
       * 同步 payload 的结构、字段名与 source 完全照抄 `addSport`（entityType exerciseLogs），
       * 因此服务端与 addSport 走的是同一条 exercise_logs 写入路径，不需要后端改动。
       */
      addSportAt: (sportKey, minutes, dateISO) =>
        set((s) => {
          const item = sportItemByKey(sportKey);
          if (!item) return s;
          const day = fromDateKey(dateISO);
          if (Number.isNaN(day.getTime())) return s;
          day.setHours(12, 0, 0, 0);
          const createdAt = day.toISOString();
          const clientId = uid();
          const mins = Math.max(1, Math.min(600, Math.round(minutes || item.defaultMinutes)));
          const rec: LocalSportLog = {
            id: nextId(),
            clientId,
            sportKey: item.key,
            name: item.name,
            type: item.type,
            minutes: mins,
            createdAt,
          };
          const change: PendingChange = {
            changeId: uid(),
            ownerUserId: s.ownerUserId,
            entityType: "exerciseLogs",
            entityId: clientId,
            operation: "CREATE",
            version: 1,
            payload: {
              clientId,
              type: item.type,
              typeLabel: item.name,
              durationSeconds: mins * 60,
              source: "MANUAL",
              startedAt: createdAt,
            },
            updatedAt: createdAt,
          };
          return { sports: [...s.sports, rec], pendingChanges: [change, ...s.pendingChanges] };
        }),

      removeSport: (clientId) =>
        set((s) => {
          const rec = s.sports.find((x) => x.clientId === clientId);
          if (!rec) return s;
          const now = new Date().toISOString();
          const change: PendingChange = {
            changeId: uid(),
            ownerUserId: s.ownerUserId,
            entityType: "exerciseLogs",
            entityId: rec.clientId || "srv-" + rec.id,
            operation: "DELETE",
            version: 1,
            payload: null,
            updatedAt: now,
          };
          return {
            sports: s.sports.filter((x) => x.clientId !== clientId),
            pendingChanges: [change, ...s.pendingChanges],
          };
        }),

      /** 旧版 sport-store（6 项、仅本地）一次性并入并补同步 */
      importLegacySports: (records) =>
        set((s) => {
          if (!records.length) return s;
          const now = new Date().toISOString();
          const sports = [...s.sports];
          const changes = [...s.pendingChanges];
          for (const r of records) {
            const item = sportItemByKey(r.sportKey);
            if (!item) continue;
            if (sports.some((x) => x.sportKey === item.key && x.createdAt === r.createdAt)) continue;
            const clientId = uid();
            const minutes = Math.max(1, Math.min(600, Math.round(r.minutes)));
            const createdAt = r.createdAt || now;
            sports.push({ id: nextId(), clientId, sportKey: item.key, name: item.name, type: item.type, minutes, createdAt });
            changes.unshift({
              changeId: uid(),
              ownerUserId: s.ownerUserId,
              entityType: "exerciseLogs",
              entityId: clientId,
              operation: "CREATE",
              version: 1,
              payload: {
                clientId,
                type: item.type,
                typeLabel: item.name,
                durationSeconds: minutes * 60,
                source: "MANUAL",
                startedAt: createdAt,
              },
              updatedAt: createdAt,
            });
          }
          return { sports, pendingChanges: changes };
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
          let sports = [...s.sports];
          let habits = [...s.habits];
          let habitLogs = [...s.habitLogs];

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
                case "exerciseLogs":
                  sports = sports.filter((x) => (x.clientId || "srv-" + x.id) !== c.entityId);
                  break;
                case "habits":
                  habits = habits.filter((x) => (x.clientId || "srv-" + x.id) !== c.entityId);
                  break;
                case "habitLogs":
                  habitLogs = habitLogs.filter((x) => x.entityId !== c.entityId);
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
                  careerKey: sval(p.careerKey, "ict"),
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
                  careerKey: sval(p.careerKey, "ict"),
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
              case "exerciseLogs": {
                // 服务端 payload：{ type, typeLabel, durationSeconds, source, startedAt }；本地补 sportKey 便于图标
                const name = sval(p.typeLabel, "运动");
                const catalogItem = sportItemByKey(sval(p.sportKey)) ??
                  // 名称反查注册表（远端记录不带 sportKey）
                  SPORT_CATALOG.find((sp) => sp.name === name);
                const rec: LocalSportLog = {
                  id: nval(p.id, nextId()),
                  clientId: c.entityId,
                  sportKey: catalogItem?.key ?? "",
                  name,
                  type: (p.type as ExerciseType) ?? catalogItem?.type ?? "OTHER",
                  minutes: Math.max(1, Math.round(nval(p.durationSeconds) / 60)),
                  createdAt: sval(p.startedAt, new Date().toISOString()),
                };
                const idx = sports.findIndex((x) => (x.clientId || "srv-" + x.id) === c.entityId);
                if (idx >= 0) sports[idx] = rec;
                else sports = [...sports, rec];
                break;
              }
              case "habits": {
                // 服务端 payload：{ name, icon, isBoolean, targetValue, unit, schedule, color, sortOrder }
                const color = sval(p.color, "#6366f1");
                const habit: LocalHabit = {
                  id: nval(p.id, nextId()),
                  clientId: c.entityId.startsWith("srv-") ? undefined : c.entityId,
                  name: sval(p.name, "习惯"),
                  icon: snull(p.icon),
                  isBoolean: typeof p.isBoolean === "boolean" ? p.isBoolean : true,
                  targetValue: nnull(p.targetValue),
                  unit: snull(p.unit),
                  schedule: (() => {
                    const days = Array.isArray(p.schedule)
                      ? [...new Set(p.schedule.map((n) => nval(n)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort(
                          (a, b) => a - b
                        )
                      : [];
                    return days.length > 0 ? days : [0, 1, 2, 3, 4, 5, 6];
                  })(),
                  color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#6366f1",
                  sortOrder: nval(p.sortOrder),
                  updatedAt: c.updatedAt,
                };
                const idx = habits.findIndex((x) => (x.clientId || "srv-" + x.id) === c.entityId);
                if (idx >= 0) habits[idx] = habit;
                else habits = [...habits, habit];
                break;
              }
              case "habitLogs": {
                // entityId = "<habitClientId>|<YYYY-MM-DD>"；服务端 payload 也带 habitClientId/logDate
                const [entityHabitId, entityDate] = c.entityId.split("|");
                const habitClientId = sval(p.habitClientId, entityHabitId ?? "");
                const logDate = sval(p.logDate, entityDate ?? "");
                if (!habitClientId || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) break;
                const log: LocalHabitLog = {
                  entityId: c.entityId,
                  habitClientId,
                  logDate,
                  value: Math.max(0, nval(p.value, 1)),
                  note: snull(p.note),
                  updatedAt: c.updatedAt,
                };
                const idx = habitLogs.findIndex((x) => x.entityId === c.entityId);
                if (idx >= 0) habitLogs[idx] = log;
                else habitLogs = [...habitLogs, log];
                break;
              }
            }
          }

          return { progress, tasks, logs, sessions, checkins, github, customTopics, sports, habits, habitLogs };
        }),

      clearPendingChanges: (sent) => {
        if (!sent) {
          set({ pendingChanges: [] });
          return;
        }
        // 按引用或幂等键精确移除本批，期间用户新增的变更保留
        const sentRefs = new Set(sent);
        const sentIds = new Set(sent.map((c) => c.changeId).filter(Boolean) as string[]);
        set((state) => ({
          pendingChanges: state.pendingChanges.filter(
            (c) => !sentRefs.has(c) && !(c.changeId && sentIds.has(c.changeId))
          ),
        }));
      },
      setLastSyncedAt: (t) => set({ lastSyncedAt: t }),
      setAiTip: (text) => set({ aiTip: { date: todayISO(), text } }),
      });
    },
    {
      name: "lwb-mobile-store",
      // S5-6：物理上拆成轻（偏好/会话）+ 重（业务数据/发件箱）两个 key，见 lib/persist.ts；
      // 旧版单 key（lwb-mobile-store）在首次读取时自动迁移并删除。
      storage: createJSONStorage(() => createSplitStorage()),
      // token 改存 expo-secure-store（Keychain/Keystore），AsyncStorage 持久化里置空
      // ownerUserId 属于本地归属标记，允许持久化（换账号时靠它识别旧队列）
      partialize: (s) => ({ ...s, token: null as string | null }),
      // S5-6：恢复结果（条数/体积/是否超限/错误）走现有 diagnostics（persist.reportRehydrate）
      onRehydrateStorage: () => (state, error) => {
        reportRehydrate(state as unknown as Record<string, unknown> | undefined, error);
      },
    }
  )
);

/**
 * 换账号隔离（S1-6）：判断一条待同步变更是否属于「当前账号之外」的账号。
 *
 * - 当前未登录（ownerUserId 为 null）：无法判定，保留（匿名 → 登录后归当前账号是正常路径）
 * - 变更自身没有 owner（旧版本持久化 / 匿名创建）：保留
 * - 双方都有明确归属且不一致：旧账号的队列，必须丢弃（否则会用新 Bearer 推上去）
 */
export function isForeignPendingChange(c: PendingChange, ownerUserId: string | null): boolean {
  if (!ownerUserId) return false;
  if (!c.ownerUserId) return false;
  return c.ownerUserId !== ownerUserId;
}

/** 从队列中挑出不属于当前账号的待同步变更（供 sync-engine 丢弃并记诊断） */
export function selectForeignPendingChanges(
  pending: PendingChange[],
  ownerUserId: string | null
): PendingChange[] {
  return pending.filter((c) => isForeignPendingChange(c, ownerUserId));
}
