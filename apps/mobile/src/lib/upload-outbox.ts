import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LegacyFileSystem from "expo-file-system/legacy";
import type { UploadKind } from "./uploads";

/**
 * 图片上传发件箱（组一 · 阶段 1「图片上传可靠性」）。
 *
 * 背景：`uploads.ts` 的旧链路是「选图 → 直接 POST」——离线、5xx 或杀进程时，
 * 用户选好的图直接丢，只能重选；桶里也可能出现「请求其实成功了但响应丢了」的孤儿。
 *
 * 现在把选图结果先**落到本机**再上传：
 * - 纯函数管理队列（可单测）：enqueue / dequeue / peek / removeByClientId
 * - 文件复制到 document 目录（**不受系统清缓存影响**，重启后仍可读）
 * - `clientId` 幂等键：服务端按 (user_id, client_id) 去重（见 /api/uploads），补发不会落两份
 * - 成功后删本机副本；取消/换图时丢弃待发送项并删文件（不留孤儿）
 */
export const UPLOAD_OUTBOX_KEY = "lwb.uploads.outbox.v1";

/** document 目录下的待上传暂存目录（重启后仍可读，与 cacheDirectory 不同） */
export function pendingUploadDir(): string {
  return (LegacyFileSystem.documentDirectory ?? "") + "pending-uploads/";
}

export interface UploadOp {
  opId: string;
  /** 幂等键：同一次选图在整条链路上保持不变 */
  clientId: string;
  kind: UploadKind;
  /** 已复制到 document 目录的文件 uri（重启后仍可读） */
  fileUri: string;
  mimeType: string;
  /** 相册返回的原始 uri：只用于当场乐观展示，重启后不保证有效 */
  displayUri: string;
  queuedAt: string;
}

export interface UploadOutboxState {
  ops: UploadOp[];
}

export const EMPTY_UPLOAD_OUTBOX: UploadOutboxState = { ops: [] };

let seq = 0;
function makeOpId(): string {
  seq += 1;
  return `up-${Date.now().toString(36)}-${seq}`;
}

/** 生成幂等键（客户端唯一即可，服务端只用它去重） */
export function makeClientId(): string {
  return `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface UploadOpInput {
  clientId?: string;
  kind: UploadKind;
  fileUri: string;
  mimeType: string;
  displayUri?: string;
}

export function makeUploadOp(input: UploadOpInput): UploadOp {
  return {
    opId: makeOpId(),
    clientId: input.clientId ?? makeClientId(),
    kind: input.kind,
    fileUri: input.fileUri,
    mimeType: input.mimeType,
    displayUri: input.displayUri ?? input.fileUri,
    queuedAt: new Date().toISOString(),
  };
}

/** 入队（同 clientId 覆盖，避免重复补发） */
export function enqueue(state: UploadOutboxState, op: UploadOp): UploadOutboxState {
  const idx = state.ops.findIndex((o) => o.clientId === op.clientId);
  if (idx >= 0) {
    const ops = [...state.ops];
    ops[idx] = op;
    return { ops };
  }
  return { ops: [...state.ops, op] };
}

export function dequeue(state: UploadOutboxState, opId: string): UploadOutboxState {
  return { ops: state.ops.filter((o) => o.opId !== opId) };
}

/** 队首（按入队顺序上传，保证「先选的先传」） */
export function peek(state: UploadOutboxState): UploadOp | null {
  return state.ops[0] ?? null;
}

export function pendingCount(state: UploadOutboxState): number {
  return state.ops.length;
}

export function findByClientId(state: UploadOutboxState, clientId: string): UploadOp | null {
  return state.ops.find((o) => o.clientId === clientId) ?? null;
}

/** 丢弃待发送项（换图 / 删除时用），返回丢弃的那条以便清理本机文件 */
export function removeByClientId(state: UploadOutboxState, clientId: string): { state: UploadOutboxState; removed: UploadOp | null } {
  const removed = findByClientId(state, clientId);
  if (!removed) return { state, removed: null };
  return { state: dequeue(state, removed.opId), removed };
}

/** 丢弃所有指向同一张图（本机 uri 或已上传 url）的待发送项 */
export function removeByUri(state: UploadOutboxState, uri: string): { state: UploadOutboxState; removed: UploadOp[] } {
  const removed = state.ops.filter((o) => o.fileUri === uri || o.displayUri === uri || o.clientId === uri);
  if (removed.length === 0) return { state, removed };
  const ids = new Set(removed.map((o) => o.opId));
  return { state: { ops: state.ops.filter((o) => !ids.has(o.opId)) }, removed };
}

/**
 * 本机临时地址判定：`file:` / `content:` / `ph:` / `assets-library:` 都不是服务端可存的值。
 * 保存记录前必须拦掉（否则会把本机路径写进数据库）。
 */
export function isLocalFileUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return /^(file|content|ph|assets-library|blob):/i.test(uri.trim());
}

/** mime → 扩展名（服务端按 type 校验，扩展名与 type 必须一致） */
export function extForMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic" || mimeType === "image/heif") return "heic";
  return "jpg";
}

export async function loadOutbox(): Promise<UploadOutboxState> {
  try {
    const raw = await AsyncStorage.getItem(UPLOAD_OUTBOX_KEY);
    if (!raw) return EMPTY_UPLOAD_OUTBOX;
    const parsed = JSON.parse(raw) as UploadOutboxState;
    return Array.isArray(parsed?.ops) ? parsed : EMPTY_UPLOAD_OUTBOX;
  } catch {
    return EMPTY_UPLOAD_OUTBOX;
  }
}

export async function saveOutbox(state: UploadOutboxState): Promise<void> {
  try {
    if (state.ops.length === 0) await AsyncStorage.removeItem(UPLOAD_OUTBOX_KEY);
    else await AsyncStorage.setItem(UPLOAD_OUTBOX_KEY, JSON.stringify(state));
  } catch {
    // 存储失败不阻塞主流程
  }
}

async function ensurePendingDir(): Promise<void> {
  try {
    const dir = pendingUploadDir();
    if (!dir.startsWith("file:")) return;
    const info = await LegacyFileSystem.getInfoAsync(dir);
    if (!info.exists) await LegacyFileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // 建目录失败时 persistPickedImage 会降级为原始 uri
  }
}

/**
 * 把选中的图复制到 document 目录（持久化），返回可长期读取的本机 uri。
 * 复制失败时降级返回原始 uri（当前会话仍可用，只是重启后可能失效）。
 */
export async function persistPickedImage(
  uri: string,
  mimeType: string,
  clientId: string
): Promise<string> {
  try {
    await ensurePendingDir();
    const dest = pendingUploadDir() + clientId + "." + extForMime(mimeType);
    await LegacyFileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

/** 删除本机暂存副本（成功后 / 取消时清理；失败忽略，不留脏状态） */
export async function removeLocalFile(uri: string): Promise<void> {
  try {
    if (!isLocalFileUri(uri)) return;
    await LegacyFileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // 忽略
  }
}
