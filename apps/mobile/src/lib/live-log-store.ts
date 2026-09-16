import AsyncStorage from "@react-native-async-storage/async-storage";
import { createLiveLog, parseLiveLog, type LiveLogDoc } from "@/lib/live-log";

/**
 * LiveLog 的本机存储（**只在本机**，不参与同步；UI 上写明"本机保存"）。
 *
 * 为什么不做服务端：本轮零迁移/零后端改动（见 v4 方案 P4-c 的存储取舍），
 * 而且手摆的贴纸位置属于"玩法产物"，与 `meal_entries` 的统计口径无关 —— 混进同步协议
 * 会让 `/api/sync` 的实体类型和幂等语义都要跟着改，收益不值。
 */
const KEY = "lwb.livelog.v1";

export async function loadLiveLog(): Promise<LiveLogDoc> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return parseLiveLog(raw) ?? createLiveLog();
  } catch {
    return createLiveLog();
  }
}

export async function saveLiveLog(doc: LiveLogDoc): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(doc));
  } catch {
    // 存不下（空间不足等）：忽略，界面仍可继续摆
  }
}
