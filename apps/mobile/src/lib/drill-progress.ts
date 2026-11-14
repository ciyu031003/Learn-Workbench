import AsyncStorage from "@react-native-async-storage/async-storage";
import { bucketKeyOf, parseSeenStore, type SeenStore } from "./drill-progress-core";

/**
 * 408 刷卡「已看」进度（v2.6.9）
 *
 * 问题：以前只持久化队列本身，不持久化看到第几张；退出或重进后 index 归零，
 * 已看过的卡会重新从第一张开始。现在按「科目 + 本地日期」记录已看过的 cardKey，
 * 重新进入时先过滤掉已看过的卡，天然从下一张继续。
 *
 * 口径（与产品确认）：
 * - 翻面即算「已看」，评级只影响 FSRS 掌握度，不影响当日续播；
 * - 每个科目每天默认 20 张，换科目各自独立；
 * - 跨天自动重置（date 不匹配即视为空）。
 */

const STORAGE_KEY = "lwb.exam408.drillSeen.v1";
/** 单个科目一天最多记多少条，防止异常数据无限增长 */
const MAX_KEYS_PER_DAY = 200;

async function readStore(): Promise<SeenStore> {
  try {
    return parseSeenStore(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

/** 读取某科目「今天」已看过的 cardKey；跨天/损坏一律返回空数组 */
export async function loadSeen(subject: string, today: string): Promise<string[]> {
  const store = await readStore();
  const bucket = store[bucketKeyOf(subject)];
  if (!bucket || bucket.date !== today) return [];
  return bucket.keys;
}

/** 记一张已看；同一张重复标记不会增长 */
export async function markSeen(subject: string, today: string, cardKey: string): Promise<void> {
  const key = cardKey.trim();
  if (!key) return;
  const store = await readStore();
  const id = bucketKeyOf(subject);
  const bucket = store[id] && store[id].date === today ? store[id] : { date: today, keys: [] };
  if (bucket.keys.includes(key)) return;
  const keys = [...bucket.keys, key].slice(-MAX_KEYS_PER_DAY);
  const next: SeenStore = { ...store, [id]: { date: today, keys } };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 存储失败不影响刷卡的当前会话
  }
}

/** 「再刷一轮」：清空该科目今日已看记录 */
export async function resetSeen(subject: string, today: string): Promise<void> {
  const store = await readStore();
  const id = bucketKeyOf(subject);
  if (!store[id]) return;
  const next = { ...store };
  delete next[id];
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 忽略
  }
}