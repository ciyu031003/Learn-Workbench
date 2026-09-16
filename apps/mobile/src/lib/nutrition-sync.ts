import { getApiUrl } from "@/config";
import type { OutboxOp } from "./nutrition-outbox";

/**
 * 饮食写操作的"发货"实现（屏幕内提交与后台补发共用同一份）。
 *
 * 背景（v1.3.5 真机反馈）：原来 `sendOp` 把 fetch 抛异常与**任何非 2xx** 都当成
 * 「网络不可用」，于是 400/401/404/500 都会弹一句"本机当前网络不可用，联网后会自动补发"，
 * 既误导用户（明明开着流量），也让真实原因在端上完全不可见。
 *
 * 现在把结果分成四类，分别决定"是否入队重试"与"是否提示用户"：
 *  - offline：设备确实没网 / 连不上 → 静默入队，不打扰用户，联网后自动补发
 *  - server ：有网但服务端 5xx 或连接被拒 → 静默入队（可能是临时故障）
 *  - client ：4xx 校验/参数问题 → **不入队**（重试永远不会成功），把服务端原因告诉用户
 *  - auth   ：401 未登录 → 入队保留，但提示需要登录
 */
export type SendOutcome =
  | { ok: true }
  | { ok: false; kind: "offline" | "server" | "client" | "auth"; status?: number; message?: string };

/** 是否值得进发件箱等联网重试 */
export function isRetryable(outcome: SendOutcome): boolean {
  if (outcome.ok) return false;
  return outcome.kind !== "client";
}

async function readErrorMessage(res: Response): Promise<string | undefined> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
      return (data as { error: string }).error;
    }
  } catch {
    // 响应体不是 JSON：忽略
  }
  return undefined;
}

/** 设备是否在线（只在请求失败时调用，避免每次写操作都多打一次系统查询） */
async function isDeviceOnline(): Promise<boolean> {
  try {
    const Network = await import("expo-network");
    const state = await Network.getNetworkStateAsync();
    return state.type !== Network.NetworkStateType.NONE && state.isInternetReachable !== false;
  } catch {
    // 拿不到网络状态：按在线处理（后续按 server 重试，不会误报"没网"）
    return true;
  }
}

export async function sendNutritionOp(op: OutboxOp, token: string | null): Promise<SendOutcome> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    if (op.kind === "create") {
      res = await fetch(getApiUrl() + "/api/nutrition", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...op.body, clientId: op.clientId }),
      });
    } else if (op.kind === "update") {
      res = await fetch(getApiUrl() + "/api/nutrition", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ ...op.body, id: op.id }),
      });
    } else {
      res = await fetch(`${getApiUrl()}/api/nutrition?id=${op.id}`, { method: "DELETE", headers });
    }
  } catch {
    const online = await isDeviceOnline();
    return { ok: false, kind: online ? "server" : "offline" };
  }

  if (res.ok) return { ok: true };

  const message = await readErrorMessage(res);
  if (res.status === 401) return { ok: false, kind: "auth", status: 401, message };
  if (res.status >= 500) return { ok: false, kind: "server", status: res.status, message };
  return { ok: false, kind: "client", status: res.status, message };
}

/**
 * 把一条操作结果翻译成发件箱需要的动作：
 *  - "ok"    成功出队
 *  - "retry" 保留在队列里等下次（离线 / 服务端错误 / 未登录）
 *  - "drop"  从队列里丢弃（4xx 校验错误，重试永远不会成功，避免堵住队首）
 */
export function toFlushOutcome(outcome: SendOutcome): "ok" | "retry" | "drop" {
  if (outcome.ok) return "ok";
  return outcome.kind === "client" ? "drop" : "retry";
}

let flushing = false;

/**
 * 后台补发饮食发件箱（网络恢复 / 回前台时由 sync-engine 调用）。
 *
 * v1.3.5 的现状：饮食发件箱**只在进入/刷新饮食页时**才补发，所以"联网后自动补发"只对了一半。
 * 这里不依赖登录态 —— 匿名用户也能写（服务端用 anon cookie 归属数据）。
 */
export async function flushNutritionOutbox(
  token: string | null
): Promise<{ sent: number; dropped: number; remaining: number }> {
  if (flushing) return { sent: 0, dropped: 0, remaining: -1 };
  flushing = true;
  try {
    const { flushOutbox } = await import("./nutrition-outbox");
    return await flushOutbox(async (op) => toFlushOutcome(await sendNutritionOp(op, token)));
  } catch {
    return { sent: 0, dropped: 0, remaining: -1 };
  } finally {
    flushing = false;
  }
}
