/**
 * 阅读状态：本地优先（离线可用）+ 联网补推 + 跨设备拉取（组二 · 阶段 8 = V3 Phase B）。
 *
 * 为什么本地优先：技术课程正文是**打包进 App** 的（离线本来就能读），
 * 如果"读完/收藏"必须联网才能记，那离线读完的一整章会丢进度 —— 这类丢数据的体验正是组一要消灭的。
 *
 * 数据流：
 *   本地写（markRead / toggleFavorite）→ 立即落 AsyncStorage（`pending` 记待推送 op）
 *   → 联网时 pushPending（逐条 POST，失败留着下次）→ pullRemote（GET 服务端状态）→ mergeRemote 合并且清 pending
 *
 * 合并口径（可解释，避免"两边各写一半"丢状态）：
 *   - 阅读：progress 取大、firstReadAt 取早、lastReadAt 取晚、readCount 取大；
 *   - 收藏：服务端"生效中"的收藏与本地并集（本地以 pending op 的形式表达取消，push 之后再拉取，所以不会打架）。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LearningFavorite, LearningLibraryState, LearningReadState } from "@learn-workbench/shared";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";

export const READING_STATE_KEY = "lwb-reading-state-v1";
const MAX_PENDING = 200;

export interface ReadingPointRef {
  pointKey: string;
  trackSlug: string;
  stageKey: string;
  topicKey: string;
}

export interface LocalReadState extends ReadingPointRef {
  firstReadAt: string;
  lastReadAt: string;
  progress: number;
  readCount: number;
}

export interface LocalFavorite extends ReadingPointRef {
  createdAt: string;
}

export type ReadingPendingOp =
  | { kind: "read"; ref: ReadingPointRef; progress: number; at: string }
  | { kind: "favorite"; ref: ReadingPointRef; favorite: boolean; at: string };

export interface ReadingStore {
  read: Record<string, LocalReadState>;
  favorites: Record<string, LocalFavorite>;
  pending: ReadingPendingOp[];
}

export function emptyReadingStore(): ReadingStore {
  return { read: {}, favorites: {}, pending: [] };
}

function refOf(input: ReadingPointRef): ReadingPointRef {
  return {
    pointKey: input.pointKey,
    trackSlug: input.trackSlug,
    stageKey: input.stageKey,
    topicKey: input.topicKey,
  };
}

function clampProgress(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value as number)));
}

/** 记一次阅读：进度只增不减、first_read_at 不变、read_count 递增。 */
export function markRead(
  store: ReadingStore,
  input: ReadingPointRef & { progress?: number },
  now: Date = new Date()
): ReadingStore {
  const ref = refOf(input);
  const at = now.toISOString();
  const progress = clampProgress(input.progress);
  const current = store.read[ref.pointKey];
  const next: LocalReadState = current
    ? {
        ...current,
        progress: Math.max(current.progress, progress),
        readCount: current.readCount + 1,
        lastReadAt: at,
      }
    : { ...ref, firstReadAt: at, lastReadAt: at, progress, readCount: 1 };
  const op: ReadingPendingOp = { kind: "read", ref, progress, at };
  return {
    read: { ...store.read, [ref.pointKey]: next },
    favorites: store.favorites,
    pending: [...store.pending, op].slice(-MAX_PENDING),
  };
}

/** 收藏开关：已收藏再点=取消。返回新 store（本地立即生效）。 */
export function toggleFavorite(
  store: ReadingStore,
  input: ReadingPointRef,
  now: Date = new Date()
): ReadingStore {
  const ref = refOf(input);
  const at = now.toISOString();
  const active = Boolean(store.favorites[ref.pointKey]);
  const favorites = { ...store.favorites };
  if (active) delete favorites[ref.pointKey];
  else favorites[ref.pointKey] = { ...ref, createdAt: at };
  const op: ReadingPendingOp = { kind: "favorite", ref, favorite: !active, at };
  return {
    read: store.read,
    favorites,
    pending: [...store.pending, op].slice(-MAX_PENDING),
  };
}

export function isFavorite(store: ReadingStore, pointKey: string): boolean {
  return Boolean(store.favorites[pointKey]);
}

export function readStateOf(store: ReadingStore, pointKey: string): LocalReadState | null {
  return store.read[pointKey] ?? null;
}

export function pendingCount(store: ReadingStore): number {
  return store.pending.length;
}

/** 最近读过、且还没读完的那一节（"继续学习"卡片用）。 */
export function continueReading(store: ReadingStore): LocalReadState | null {
  const rows = Object.values(store.read).filter((item) => item.progress < 100);
  if (rows.length === 0) return null;
  return rows.sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt))[0];
}

/** 某课程的阅读/收藏集合（课程页标记用）。 */
export function trackReadingSummary(store: ReadingStore, trackSlug: string): { read: string[]; favorites: string[] } {
  return {
    read: Object.values(store.read)
      .filter((item) => item.trackSlug === trackSlug)
      .map((item) => item.pointKey),
    favorites: Object.values(store.favorites)
      .filter((item) => item.trackSlug === trackSlug)
      .map((item) => item.pointKey),
  };
}

/**
 * 合并服务端状态（push 完成后调用）：取两边的"更完整"值，并清空 pending。
 * 不清空本地独有的记录 —— 本地有服务端没有，说明那次 push 还在路上，下次 flush 会补。
 */
export function mergeRemote(store: ReadingStore, remote: LearningLibraryState): ReadingStore {
  const read = { ...store.read };
  for (const item of remote.read) {
    const local = read[item.pointKey];
    read[item.pointKey] = local
      ? {
          ...local,
          firstReadAt: local.firstReadAt < item.firstReadAt ? local.firstReadAt : item.firstReadAt,
          lastReadAt: local.lastReadAt > item.lastReadAt ? local.lastReadAt : item.lastReadAt,
          progress: Math.max(local.progress, item.progress),
          readCount: Math.max(local.readCount, item.readCount),
        }
      : toLocalRead(item);
  }
  const favorites = { ...store.favorites };
  for (const item of remote.favorites) {
    if (!favorites[item.pointKey]) favorites[item.pointKey] = toLocalFavorite(item);
  }
  return { read, favorites, pending: [] };
}

function toLocalRead(item: LearningReadState): LocalReadState {
  return {
    pointKey: item.pointKey,
    trackSlug: item.trackSlug,
    stageKey: item.stageKey,
    topicKey: item.topicKey,
    firstReadAt: item.firstReadAt,
    lastReadAt: item.lastReadAt,
    progress: item.progress,
    readCount: item.readCount,
  };
}

function toLocalFavorite(item: LearningFavorite): LocalFavorite {
  return {
    pointKey: item.pointKey,
    trackSlug: item.trackSlug,
    stageKey: item.stageKey,
    topicKey: item.topicKey,
    createdAt: item.createdAt,
  };
}

function isReadingStore(value: unknown): value is ReadingStore {
  if (!value || typeof value !== "object") return false;
  const store = value as Partial<ReadingStore>;
  return Boolean(store.read && typeof store.read === "object") &&
    Boolean(store.favorites && typeof store.favorites === "object") &&
    Array.isArray(store.pending);
}

export async function loadReadingStore(): Promise<ReadingStore> {
  try {
    const raw = await AsyncStorage.getItem(READING_STATE_KEY);
    if (!raw) return emptyReadingStore();
    const parsed = JSON.parse(raw) as unknown;
    return isReadingStore(parsed) ? parsed : emptyReadingStore();
  } catch {
    return emptyReadingStore();
  }
}

export async function saveReadingStore(store: ReadingStore): Promise<void> {
  try {
    await AsyncStorage.setItem(READING_STATE_KEY, JSON.stringify(store));
  } catch {
    // 本地写入失败不应打断阅读
  }
}

function authHeaders(): Record<string, string> | null {
  const token = useAppStore.getState().token;
  if (!token) return null;
  return { "content-type": "application/json", Authorization: `Bearer ${token}` };
}

/**
 * 推送待同步 op（逐条，失败即停并保留剩余 op 下次再推）。
 * 返回实际推送成功的条数。
 */
export async function pushPendingOps(store: ReadingStore): Promise<{ pushed: number; store: ReadingStore }> {
  const headers = authHeaders();
  if (!headers) return { pushed: 0, store };
  let pushed = 0;
  for (let index = 0; index < store.pending.length; index += 1) {
    const op = store.pending[index];
    const url = op.kind === "read" ? "/api/learning/read" : "/api/learning/favorite";
    const body =
      op.kind === "read"
        ? { ...op.ref, progress: op.progress }
        : { ...op.ref, favorite: op.favorite };
    try {
      const response = await fetch(getApiUrl() + url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok && response.status !== 409) throw new Error("HTTP " + response.status);
      pushed += 1;
    } catch {
      // 失败即停：保留这一条与后面全部，下次再推（顺序不能乱，否则取消收藏可能先于收藏到达）
      return { pushed, store: { ...store, pending: store.pending.slice(index) } };
    }
  }
  return { pushed, store: { ...store, pending: [] } };
}

/** 拉服务端状态；拿不到权威答案（未登录/失败）时返回 null，调用方保持本地状态。 */
export async function pullRemoteState(trackSlug?: string): Promise<LearningLibraryState | null> {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const url = getApiUrl() + "/api/learning/library-state" + (trackSlug ? `?track=${encodeURIComponent(trackSlug)}` : "");
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<LearningLibraryState> | null;
    if (!data || !Array.isArray(data.read) || !Array.isArray(data.favorites)) return null;
    return {
      read: data.read,
      favorites: data.favorites,
      counts: data.counts ?? {
        read: data.read.length,
        favorites: data.favorites.length,
        readThisWeek: 0,
      },
    };
  } catch {
    return null;
  }
}

/** 读侧入口：记一次阅读（本地立即生效 + 尽力推送）。 */
export async function markTopicRead(
  input: ReadingPointRef & { progress?: number },
  now: Date = new Date()
): Promise<ReadingStore> {
  const store = markRead(await loadReadingStore(), input, now);
  await saveReadingStore(store);
  const { store: flushed } = await pushPendingOps(store);
  await saveReadingStore(flushed);
  return flushed;
}

/** 读侧入口：收藏开关（本地立即生效 + 尽力推送）。 */
export async function toggleTopicFavorite(input: ReadingPointRef, now: Date = new Date()): Promise<ReadingStore> {
  const store = toggleFavorite(await loadReadingStore(), input, now);
  await saveReadingStore(store);
  const { store: flushed } = await pushPendingOps(store);
  await saveReadingStore(flushed);
  return flushed;
}

/** 跨设备同步：先推后拉再合并（App 回到前台时调用）。 */
export async function syncReadingState(trackSlug?: string): Promise<ReadingStore> {
  const loaded = await loadReadingStore();
  const { store: pushed } = await pushPendingOps(loaded);
  const remote = await pullRemoteState(trackSlug);
  const merged = remote ? mergeRemote(pushed, remote) : pushed;
  await saveReadingStore(merged);
  return merged;
}
