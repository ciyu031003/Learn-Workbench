import { getApiUrl } from "@/config";
import { classifyFetchFailure, classifyResponse, toFlushOutcome, type SendOutcome } from "./send-outcome";
import {
  dequeue,
  extForMime,
  loadOutbox,
  removeLocalFile,
  saveOutbox,
  type UploadOp,
} from "./upload-outbox";
import type { UploadKind } from "./uploads";

/**
 * 图片发件箱的「发货」实现（屏幕内即时上传与后台补发共用同一份）。
 *
 * 结果分类沿用 ./send-outcome 的四分类（offline / server / client / auth）：
 * 只有 client（4xx 校验错）才丢弃，其余留在队列里等联网/回前台重试。
 */
export type UploadSendResult =
  | { ok: true; url: string; id: number | null }
  | { ok: false; outcome: SendOutcome };

function buildForm(op: UploadOp): FormData {
  const form = new FormData();
  // RN 的 FormData 接受 { uri, name, type } 形态（name 的扩展名要与 type 一致）
  form.append("file", {
    uri: op.fileUri,
    name: "upload." + extForMime(op.mimeType),
    type: op.mimeType,
  } as unknown as Blob);
  form.append("kind", op.kind);
  form.append("clientId", op.clientId);
  return form;
}

export async function sendUploadOp(op: UploadOp, token: string | null): Promise<UploadSendResult> {
  let res: Response;
  try {
    res = await fetch(getApiUrl() + "/api/uploads", {
      method: "POST",
      headers: token ? { Authorization: "Bearer " + token } : {},
      body: buildForm(op),
    });
  } catch {
    return { ok: false, outcome: await classifyFetchFailure() };
  }

  const outcome = await classifyResponse(res);
  if (!outcome.ok) return { ok: false, outcome };

  const data = (await res.json().catch(() => null)) as { upload?: { url?: unknown; id?: unknown } } | null;
  return {
    ok: true,
    url: String(data?.upload?.url ?? ""),
    id: Number(data?.upload?.id) || null,
  };
}

export interface UploadResolvedEvent {
  clientId: string;
  url: string;
  id: number | null;
  kind: UploadKind;
}

/**
 * 上传成功回填订阅：屏幕在「已排队」时登记一个 applier，
 * 后台补发成功（或重试成功）后用它把 photoUrl 换成服务端 url 并保存记录。
 */
const resolvers = new Set<(event: UploadResolvedEvent) => void>();

export function onUploadResolved(cb: (event: UploadResolvedEvent) => void): () => void {
  resolvers.add(cb);
  return () => {
    resolvers.delete(cb);
  };
}

function emitResolved(event: UploadResolvedEvent): void {
  resolvers.forEach((cb) => {
    try {
      cb(event);
    } catch {
      // 单个订阅者异常不影响其他订阅者
    }
  });
}

let flushing = false;

/**
 * 后台补发图片发件箱（网络恢复 / 回前台时由 sync-engine 调用）。
 * 成功后：删本机副本 + 通知订阅者回填 url。
 */
export async function flushUploadOutbox(
  token: string | null
): Promise<{ sent: number; dropped: number; remaining: number }> {
  if (flushing) return { sent: 0, dropped: 0, remaining: -1 };
  flushing = true;
  try {
    let state = await loadOutbox();
    let sent = 0;
    let dropped = 0;
    while (state.ops.length > 0) {
      const op = state.ops[0];
      const result = await sendUploadOp(op, token);
      const step = result.ok ? "ok" : toFlushOutcome(result.outcome);
      if (step === "retry") break;

      state = dequeue(state, op.opId);
      await saveOutbox(state);

      if (step === "ok" && result.ok) {
        sent += 1;
        void removeLocalFile(op.fileUri);
        emitResolved({ clientId: op.clientId, url: result.url, id: result.id, kind: op.kind });
      } else {
        // 4xx：重试永远不会成功，删本机副本避免占空间
        dropped += 1;
        void removeLocalFile(op.fileUri);
      }
    }
    return { sent, dropped, remaining: state.ops.length };
  } catch {
    return { sent: 0, dropped: 0, remaining: -1 };
  } finally {
    flushing = false;
  }
}
