import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppStore } from "@/store/app-store";

const LEGACY_KEY = "lwb-mobile-sports"; // 旧 sport-store 的 persist key（6 项、仅本地）
const MIGRATED_KEY = "lwb-sports-migrated-v2";

/**
 * 一次性迁移：旧 sport-store 记录（basketball/badminton/walk/run/cycling/swimming）
 * 并入 app-store.sports 并入同步队列（exerciseLogs），完成后打标记。
 * 旧 key 数据保留不删，迁移失败不影响启动。
 */
export async function migrateLegacySports(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(MIGRATED_KEY)) === "1") return;
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        state?: { records?: { kind?: string; minutes?: number; createdAt?: string }[] };
      };
      const records = (parsed?.state?.records ?? [])
        .filter((r) => r && typeof r.kind === "string" && Number(r.minutes) > 0)
        .map((r) => ({
          sportKey: String(r.kind),
          minutes: Math.max(1, Math.round(Number(r.minutes))),
          createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
        }));
      useAppStore.getState().importLegacySports(records);
    }
    await AsyncStorage.setItem(MIGRATED_KEY, "1");
  } catch {
    // 静默：下次启动重试
  }
}
