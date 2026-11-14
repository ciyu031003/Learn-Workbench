import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CELEBRATION_STORAGE_KEY,
  claimCelebrationInLog,
  parseCelebrationLog,
  type CelebrationKind,
} from "@/lib/celebration-core";

/**
 * 「同一天同一事件只庆祝一次」的持久化入口。
 *
 * 读-改-写必须串行，否则两个触发点同一帧到达时会各读一次旧日志、都判定为首次，
 * 结果弹两次。这里用模块级 promise 链把 claim 排成队列。
 */
let claimChain: Promise<unknown> = Promise.resolve();

export async function claimCelebration(kind: CelebrationKind, eventId: string, day: string): Promise<boolean> {
  const run = claimChain.then(async () => {
    try {
      const raw = await AsyncStorage.getItem(CELEBRATION_STORAGE_KEY);
      const log = parseCelebrationLog(raw);
      const result = claimCelebrationInLog(log, kind, eventId, day);
      if (result.claimed) {
        await AsyncStorage.setItem(CELEBRATION_STORAGE_KEY, JSON.stringify(result.log));
      }
      return result.claimed;
    } catch {
      // 存储不可用时不阻断庆祝：宁可偶尔多弹一次，也不要让完成瞬间毫无反馈。
      return true;
    }
  });
  claimChain = run.catch(() => undefined);
  return run;
}
