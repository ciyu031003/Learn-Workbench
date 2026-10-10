/**
 * 离线写操作的「结果分类」公共件（组一 · 阶段 1 抽出）。
 *
 * 背景（v1.3.5 真机反馈，饮食发件箱）：把 fetch 抛异常与**任何非 2xx** 都当成
 * 「网络不可用」，于是 400/401/404/500 都会弹「本机当前网络不可用」，既误导用户
 * （明明开着流量），也让真实原因在端上完全不可见。
 *
 * 现在统一分成四类，分别决定「是否入队重试」与「是否提示用户」：
 *  - offline：设备确实没网 / 连不上 → 静默入队，联网后自动补发
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

export async function readErrorMessage(res: Response): Promise<string | undefined> {
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
export async function isDeviceOnline(): Promise<boolean> {
  try {
    const Network = await import("expo-network");
    const state = await Network.getNetworkStateAsync();
    return state.type !== Network.NetworkStateType.NONE && state.isInternetReachable !== false;
  } catch {
    // 拿不到网络状态：按在线处理（后续按 server 重试，不会误报「没网」）
    return true;
  }
}

/** fetch 抛异常（连不上）：按设备是否在线区分 offline / server */
export async function classifyFetchFailure(): Promise<SendOutcome> {
  const online = await isDeviceOnline();
  return { ok: false, kind: online ? "server" : "offline" };
}

/** 拿到响应后的分类（ok / 401 / 5xx / 其他 4xx） */
export async function classifyResponse(res: Response): Promise<SendOutcome> {
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
