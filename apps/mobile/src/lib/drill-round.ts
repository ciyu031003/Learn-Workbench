import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Exam408CardQueue } from "@/lib/exam-408-cards";
import { bucketKeyOf, type DrillScope } from "./drill-progress-core";

/**
 * 当日刷卡「整轮快照」（v2.6.12）。
 *
 * 为什么需要它：FSRS 评级后服务端当天通常不再返回这些卡，若「再刷一轮」只是
 * resetSeen + 重新拉队列，往往拿到的是空队列 —— 按钮看起来生效，实际刷不了。
 * 这里在当天第一次成功拉队列时留一份**未裁剪**的原始 20 张，重刷时直接复用，
 * 保证「再刷一轮」真的能重来一遍。
 */
const STORAGE_KEY = "lwb.exam408.round.v1";

interface RoundBucket {
  date: string;
  queue: Exam408CardQueue;
}
type RoundStore = Record<string, RoundBucket>;

let cache: RoundStore | null = null;
let chain: Promise<unknown> = Promise.resolve();

function isQueue(value: unknown): value is Exam408CardQueue {
  if (!value || typeof value !== "object") return false;
  const record = value as { cards?: unknown };
  return Array.isArray(record.cards);
}

async function readStore(): Promise<RoundStore> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = {};
      return cache;
    }
    const parsed: unknown = JSON.parse(raw);
    const out: RoundStore = {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (!value || typeof value !== "object") continue;
        const record = value as { date?: unknown; queue?: unknown };
        if (typeof record.date === "string" && isQueue(record.queue)) {
          out[key] = { date: record.date, queue: record.queue };
        }
      }
    }
    cache = out;
  } catch {
    cache = {};
  }
  return cache;
}

export async function loadRoundPlan(
  subject: string,
  today: string,
  scope: DrillScope = "queue",
): Promise<Exam408CardQueue | null> {
  const store = await readStore();
  const bucket = store[scope + "|" + bucketKeyOf(subject)];
  return bucket && bucket.date === today ? bucket.queue : null;
}

/** 当天第一次拉到队列时写入；已有当天快照就不覆盖，避免服务端后续裁剪把原始 20 张吃掉 */
export async function saveRoundPlan(
  subject: string,
  today: string,
  queue: Exam408CardQueue,
  scope: DrillScope = "queue",
): Promise<void> {
  const run = chain.then(async () => {
    const store = await readStore();
    const id = scope + "|" + bucketKeyOf(subject);
    if (store[id]?.date === today) return;
    const next: RoundStore = {};
    for (const [key, value] of Object.entries(store)) {
      if (value.date === today) next[key] = value;
    }
    next[id] = { date: today, queue };
    cache = next;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 忽略
    }
  });
  chain = run.catch(() => undefined);
  await run;
}

export async function clearRoundPlan(
  subject: string,
  today: string,
  scope: DrillScope = "queue",
): Promise<void> {
  const run = chain.then(async () => {
    const store = await readStore();
    const id = scope + "|" + bucketKeyOf(subject);
    if (store[id]?.date !== today) return;
    const next = { ...store };
    delete next[id];
    cache = next;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 忽略
    }
  });
  chain = run.catch(() => undefined);
  await run;
}
