import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  drillBucketKey,
  parseDrillPointerStore,
  pruneDrillPointerStore,
  type DrillPointer,
  type DrillPointerStore,
  type DrillScope,
} from "./drill-progress-core";

/**
 * 408 刷卡续播指针（v2.6.12）。
 *
 * 和「已看过的卡」分开存：seen 决定哪些卡不再出现，pointer 决定重新进入时停在哪一张。
 * 两者缺一不可 —— 只按 seen 过滤时，用户滑到第 10 张却没翻面，重进会回到第 1 张。
 *
 * 读取走内存缓存（一次 AsyncStorage 读），写入串行排队，避免连续滑动时
 * 两次 read-modify-write 互相覆盖。
 */
const STORAGE_KEY = "lwb.exam408.drillPointer.v1";

let cache: DrillPointerStore | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

async function readStore(): Promise<DrillPointerStore> {
  if (cache) return cache;
  try {
    cache = parseDrillPointerStore(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    cache = {};
  }
  return cache;
}

function enqueue(task: () => Promise<void>): Promise<void> {
  const run = writeChain.then(task);
  writeChain = run.catch(() => undefined);
  return run;
}

export async function loadDrillPointer(
  subject: string,
  scope: DrillScope,
  today: string,
): Promise<DrillPointer | null> {
  const store = await readStore();
  const pointer = store[drillBucketKey(subject, scope)];
  return pointer && pointer.date === today ? pointer : null;
}

export async function saveDrillPointer(
  subject: string,
  scope: DrillScope,
  today: string,
  cardKey: string,
  index: number,
): Promise<void> {
  const key = String(cardKey ?? "").trim();
  if (!key) return;
  await enqueue(async () => {
    const store = await readStore();
    const next = pruneDrillPointerStore(store, today);
    next[drillBucketKey(subject, scope)] = {
      date: today,
      cardKey: key,
      index: Math.max(0, Math.floor(index)),
    };
    cache = next;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 存储不可用不影响当前会话
    }
  });
}

export async function clearDrillPointer(subject: string, scope: DrillScope): Promise<void> {
  await enqueue(async () => {
    const store = await readStore();
    const next = { ...store };
    delete next[drillBucketKey(subject, scope)];
    cache = next;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 忽略
    }
  });
}
