import { getApiUrl } from "@/config";
import type { OutboxOp } from "./nutrition-outbox";
import { classifyFetchFailure, classifyResponse, toFlushOutcome, type SendOutcome } from "./send-outcome";

// 结果分类已抽到 ./send-outcome（图片发件箱共用同一套口径）；这里保持原导出面不变。
export { isRetryable, toFlushOutcome } from "./send-outcome";
export type { SendOutcome } from "./send-outcome";

/**
 * 饮食写操作的"发货"实现（屏幕内提交与后台补发共用同一份）。
 * 四类结果（offline / server / client / auth）的口径见 ./send-outcome。
 */
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
    return classifyFetchFailure();
  }
  return classifyResponse(res);
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
