import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MealEntry, MealKind } from "@learn-workbench/shared";

/**
 * 饮食记录的离线发件箱（v3 M4，基础设施）
 *
 * 背景：同类 App 最常见的一星差评就是「一直提示网络异常」——记录类功能必须**先本地落账**，
 * 联网后再补发。这里做最小可用版本：
 * - 纯函数管理操作队列（可单测）：enqueue（含合并）/ dequeue / peek
 * - AsyncStorage 持久化（重启不丢）
 * - flush：按顺序发送，成功即出队，遇到失败停下（保留后续，避免乱序）
 *
 * 本地临时 id 约定：**负数**（`localId`）表示"仅存在于本机、还没上传"的记录；
 * 之后的编辑/删除按 `localId` 命回该 create 操作合并，避免"先建后改"发两次请求。
 * 幂等：create 操作带 `clientId`，服务端 POST 按 clientId 去重（见 /api/nutrition）。
 */
export const OUTBOX_KEY = "lwb.nutrition.outbox.v1";

export interface MealEntryInput {
  date: string;
  meal: MealKind;
  name: string;
  amount: number;
  unit?: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  foodId?: number | null;
}

export interface CreateOp {
  opId: string;
  kind: "create";
  clientId: string;
  /** 负数本地 id（乐观 UI 用） */
  localId: number;
  body: MealEntryInput;
  queuedAt: string;
}
export interface UpdateOp {
  opId: string;
  kind: "update";
  /** 服务端 id（>0）或本地临时 id（<0，会合并进对应 create） */
  id: number;
  /** 只放**本次改动过**的字段（未提供的字段服务端保持原值） */
  body: Partial<Omit<MealEntryInput, "date">>;
  queuedAt: string;
}
export interface DeleteOp {
  opId: string;
  kind: "delete";
  id: number;
  queuedAt: string;
}
export type OutboxOp = CreateOp | UpdateOp | DeleteOp;

export interface OutboxState {
  ops: OutboxOp[];
}

export const EMPTY_OUTBOX: OutboxState = { ops: [] };

let seq = 0;
function makeOpId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

let localSeq = 0;
/** 生成本地临时 id（负数）。仅用于乐观 UI，不发给服务端。 */
export function nextLocalId(): number {
  if (localSeq === 0) localSeq = Math.floor(Date.now() % 100000);
  localSeq += 1;
  return -localSeq;
}

export function makeCreateOp(body: MealEntryInput, localId: number, clientId?: string): CreateOp {
  const cid = clientId ?? `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return { opId: makeOpId("c"), kind: "create", clientId: cid, localId, body, queuedAt: new Date().toISOString() };
}

export function makeUpdateOp(id: number, body: Partial<Omit<MealEntryInput, "date">>): UpdateOp {
  return { opId: makeOpId("u"), kind: "update", id, body, queuedAt: new Date().toISOString() };
}

export function makeDeleteOp(id: number): DeleteOp {
  return { opId: makeOpId("d"), kind: "delete", id, queuedAt: new Date().toISOString() };
}

/**
 * 入队并合并：
 * - create（同 clientId）→ 覆盖
 * - update(id<0) → 合并进对应 create 的 body（不入队新操作）
 * - update(id>0) → 与同 id 的待发送 update 合并
 * - delete(id<0) → 直接丢掉对应 create（从未上传）
 * - delete(id>0) → 丢掉同 id 的待发送 update，再入队 delete
 */
export function enqueue(state: OutboxState, op: OutboxOp): OutboxState {
  const ops = [...state.ops];

  if (op.kind === "create") {
    const idx = ops.findIndex((o) => o.kind === "create" && o.clientId === op.clientId);
    if (idx >= 0) {
      ops[idx] = op;
      return { ops };
    }
    return { ops: [...ops, op] };
  }

  if (op.kind === "update") {
    if (op.id < 0) {
      const idx = ops.findIndex((o) => o.kind === "create" && o.localId === op.id);
      if (idx >= 0) {
        const create = ops[idx] as CreateOp;
        ops[idx] = { ...create, body: { ...create.body, ...op.body } };
        return { ops };
      }
      return state; // 找不到对应本地记录：丢弃（避免产生脏请求）
    }
    const idx = ops.findIndex((o) => o.kind === "update" && o.id === op.id);
    if (idx >= 0) {
      const prev = ops[idx] as UpdateOp;
      ops[idx] = { ...prev, body: { ...prev.body, ...op.body } };
      return { ops };
    }
    return { ops: [...ops, op] };
  }

  // delete
  if (op.id < 0) {
    return { ops: ops.filter((o) => !(o.kind === "create" && o.localId === op.id)) };
  }
  return { ops: [...ops.filter((o) => !(o.kind === "update" && o.id === op.id)), op] };
}

export function dequeue(state: OutboxState, opId: string): OutboxState {
  return { ops: state.ops.filter((o) => o.opId !== opId) };
}

export function pendingCount(state: OutboxState): number {
  return state.ops.length;
}

/** 队首（按入队顺序发送） */
export function peek(state: OutboxState): OutboxOp | null {
  return state.ops[0] ?? null;
}

/** 是否还有针对某条记录的待发送操作（UI 用来显示"待同步"） */
export function hasPendingFor(state: OutboxState, id: number): boolean {
  return state.ops.some((o) =>
    o.kind === "create" ? o.localId === id : o.id === id
  );
}

/** 由待发送 body 造一条"本地临时记录"（乐观 UI 显示用，id 为负数） */
export function toLocalEntry(body: MealEntryInput, localId: number): MealEntry {
  return {
    id: localId,
    logDate: body.date,
    meal: body.meal,
    foodId: body.foodId ?? null,
    name: body.name,
    amount: body.amount,
    unit: body.unit ?? "份",
    kcal: body.kcal,
    proteinG: body.proteinG,
    carbsG: body.carbsG,
    fatG: body.fatG,
    createdAt: new Date().toISOString(),
  };
}

export async function loadOutbox(): Promise<OutboxState> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    if (!raw) return EMPTY_OUTBOX;
    const parsed = JSON.parse(raw) as OutboxState;
    return Array.isArray(parsed?.ops) ? parsed : EMPTY_OUTBOX;
  } catch {
    return EMPTY_OUTBOX;
  }
}

export async function saveOutbox(state: OutboxState): Promise<void> {
  try {
    if (state.ops.length === 0) await AsyncStorage.removeItem(OUTBOX_KEY);
    else await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(state));
  } catch {
    // 存储失败不阻塞主流程
  }
}

/** 发送一条操作的结果：成功出队 / 保留重试 / 丢弃（4xx 等重试无意义的情况，避免堵住队首） */
export type FlushStep = "ok" | "retry" | "drop";

/**
 * 顺序发送队列。
 *
 * @param send 返回 "ok" = 成功（出队继续）；"retry" = 失败但值得重试（停下，保留该条与后续）；
 *             "drop" = 该条永远不可能成功（如 4xx 校验错误），丢弃后继续处理后面的
 *
 * 设计要点（v1.3.5 真机反馈修复）：旧实现只认 boolean 且失败即 break，
 * 一条"毒丸"（例如 foodId 已失效的 404）会永久堵住它后面所有记录的补发。
 */
export async function flushOutbox(
  send: (op: OutboxOp) => Promise<FlushStep>
): Promise<{ sent: number; dropped: number; remaining: number }> {
  let state = await loadOutbox();
  let sent = 0;
  let dropped = 0;
  while (state.ops.length > 0) {
    const op = state.ops[0];
    const step = await send(op);
    if (step === "retry") break;
    state = dequeue(state, op.opId);
    if (step === "ok") sent += 1;
    else dropped += 1;
    await saveOutbox(state);
  }
  return { sent, dropped, remaining: state.ops.length };
}
