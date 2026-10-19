import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";
import {
  buildPersistReport,
  describeRehydrateSummary,
  isHeavyWriteOverBudget,
  mergePersistedState,
  splitPersistedState,
  summarizeRehydratedState,
  utf8ByteLength,
  type PersistReport,
  type PersistedSlice,
} from "./persist-core";

/**
 * 双 key 持久化（S5-6）：轻层与重层各写一个 AsyncStorage key。
 *
 *   - 物理 key 与 zustand 的 persist `name` 解耦：name 仍是逻辑名（lwb-mobile-store），
 *     真正的写入落到这两个 key；旧版本的**单 key** 数据在首次读取时自动迁移（读 → 拆 → 写两份 → 删旧 key）。
 *   - 只写变化的一半：偏好变更不重写业务数据（真机写放大问题的根因），业务变更也不重写偏好。
 *   - 单次 heavy 写 > 1.5MB 走**现有诊断**（注入的 recordCrumb sink + console.warn），
 *     onRehydrateStorage 的恢复结果也通过同一 sink 上报。
 */

export const LIGHT_STORAGE_KEY = "lwb-mobile-light-v2";
export const HEAVY_STORAGE_KEY = "lwb-mobile-data-v2";
export const LEGACY_STORAGE_KEY = "lwb-mobile-store";

export interface PersistDiagnosticEvent {
  kind: string;
  message: string;
  data?: Record<string, unknown>;
}

/** 诊断出口：由 app 入口注入 crash-capture.recordCrumb（见 app/_layout.tsx），保持本模块可单测 */
let diagnosticSink: ((event: PersistDiagnosticEvent) => void) | null = null;

export function setPersistDiagnosticSink(sink: ((event: PersistDiagnosticEvent) => void) | null): void {
  diagnosticSink = sink;
}

function reportDiagnostic(event: PersistDiagnosticEvent): void {
  // 兜底 console.warn：sink 未注入（启动极早期 / 单测）时仍能看到
  console.warn("[persist]", event.kind, event.message, event.data ?? {});
  try {
    diagnosticSink?.(event);
  } catch {
    // 诊断通道自身失败绝不能影响持久化
  }
}

let lastReport: PersistReport | null = null;
const reportListeners = new Set<() => void>();

export function getLastPersistReport(): PersistReport | null {
  return lastReport;
}

export function subscribePersistReport(listener: () => void): () => void {
  reportListeners.add(listener);
  return () => reportListeners.delete(listener);
}

function publishReport(report: PersistReport): void {
  lastReport = report;
  reportListeners.forEach((l) => l());
}

/** 测试用：清空内存中的写缓存/报告/sink（不碰 AsyncStorage） */
export function __resetPersistRuntimeForTests(): void {
  lastLightJson = null;
  lastHeavyJson = null;
  lastReport = null;
  diagnosticSink = null;
  writeChain = Promise.resolve();
}

function safeParse(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stateOf(parsed: Record<string, unknown> | null): PersistedSlice | null {
  if (!parsed) return null;
  const inner = parsed.state;
  return inner && typeof inner === "object" ? (inner as PersistedSlice) : parsed;
}

let lastLightJson: string | null = null;
let lastHeavyJson: string | null = null;
/** setItem 串行化（见 setItem 注释） */
let writeChain: Promise<void> = Promise.resolve();

async function writeSlices(
  light: PersistedSlice,
  heavy: PersistedSlice,
  force: boolean
): Promise<{ lightChanged: boolean; heavyChanged: boolean; lightBytes: number; heavyBytes: number }> {
  const lightJson = JSON.stringify(light);
  const heavyJson = JSON.stringify(heavy);
  const lightBytes = utf8ByteLength(lightJson);
  const heavyBytes = utf8ByteLength(heavyJson);
  const lightChanged = force || lightJson !== lastLightJson;
  const heavyChanged = force || heavyJson !== lastHeavyJson;
  const writes: Promise<void>[] = [];
  if (lightChanged) writes.push(AsyncStorage.setItem(LIGHT_STORAGE_KEY, lightJson));
  if (heavyChanged) writes.push(AsyncStorage.setItem(HEAVY_STORAGE_KEY, heavyJson));
  if (writes.length > 0) await Promise.all(writes);
  lastLightJson = lightJson;
  lastHeavyJson = heavyJson;
  return { lightChanged, heavyChanged, lightBytes, heavyBytes };
}

function reportWrite(source: PersistReport["source"], result: Awaited<ReturnType<typeof writeSlices>>): void {
  const report = buildPersistReport({ source, ...result, error: null });
  publishReport(report);
  if (report.heavyOverBudget) {
    reportDiagnostic({
      kind: "heavy-write-over-budget",
      message: `业务数据单次写盘 ${(report.heavyBytes / 1024).toFixed(1)}KB，超过 1.5MB 预算（请检查 sessions/pendingChanges 是否异常）`,
      data: { heavyBytes: report.heavyBytes, lightBytes: report.lightBytes },
    });
  }
}

/** 读取时优先新 key；两者都缺失时尝试迁移旧版单 key（迁移成功后删旧 key 回收空间） */
async function readSlices(): Promise<{
  light: PersistedSlice;
  heavy: PersistedSlice;
  source: PersistReport["source"];
  version: number;
}> {
  const [lightRaw, heavyRaw, legacyRaw] = await Promise.all([
    AsyncStorage.getItem(LIGHT_STORAGE_KEY),
    AsyncStorage.getItem(HEAVY_STORAGE_KEY),
    AsyncStorage.getItem(LEGACY_STORAGE_KEY),
  ]);
  const lightParsed = safeParse(lightRaw);
  const heavyParsed = safeParse(heavyRaw);

  if (!lightParsed && !heavyParsed) {
    const legacyParsed = safeParse(legacyRaw);
    const legacyState = stateOf(legacyParsed);
    if (!legacyState) {
      if (legacyRaw) {
        reportDiagnostic({
          kind: "legacy-parse-failed",
          message: "旧版本持久化数据无法解析，已回落默认状态（业务数据不完整）",
        });
      }
      return { light: {}, heavy: {}, source: "empty", version: 0 };
    }
    const { light, heavy } = splitPersistedState(legacyState);
    // 安全：token 只允许存在 secure store，历史包即使落过盘也在这里抹掉
    light.token = null;
    try {
      const result = await writeSlices(light, heavy, true);
      reportWrite("legacy", result);
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY).catch(() => undefined);
    } catch (e) {
      reportDiagnostic({ kind: "legacy-write-failed", message: e instanceof Error ? e.message : "旧数据迁移写入失败" });
    }
    return {
      light,
      heavy,
      source: "legacy",
      version: typeof legacyParsed?.version === "number" ? legacyParsed.version : 0,
    };
  }

  const light = stateOf(lightParsed) ?? {};
  const heavy = stateOf(heavyParsed) ?? {};
  if (lightRaw && !lightParsed) {
    reportDiagnostic({ kind: "light-parse-failed", message: "轻量持久化（偏好/会话）解析失败，已回落默认值" });
  }
  if (heavyRaw && !heavyParsed) {
    reportDiagnostic({
      kind: "heavy-parse-failed",
      message: "业务数据持久化解析失败，已回落空数据（可能发生写盘中断）",
    });
  }
  return {
    light,
    heavy,
    source: "split",
    version: typeof lightParsed?.version === "number" ? lightParsed.version : 0,
  };
}

/** zustand persist 的 StateStorage：对外表现为一个 key，内部拆成 light/heavy 两个物理 key */
export function createSplitStorage(): StateStorage {
  return {
    async getItem(_name: string): Promise<string | null> {
      try {
        const { light, heavy, source, version } = await readSlices();
        const merged = mergePersistedState(light, heavy);
        lastLightJson = JSON.stringify(light);
        lastHeavyJson = JSON.stringify(heavy);
        const report = buildPersistReport({
          source,
          lightBytes: utf8ByteLength(lastLightJson),
          heavyBytes: utf8ByteLength(lastHeavyJson),
          lightChanged: false,
          heavyChanged: false,
          error: null,
        });
        publishReport(report);
        if (report.heavyOverBudget) {
          reportDiagnostic({
            kind: "heavy-rehydrate-over-budget",
            message: `恢复的业务数据 ${(report.heavyBytes / 1024).toFixed(1)}KB 超过 1.5MB 预算`,
            data: { heavyBytes: report.heavyBytes },
          });
        }
        if (source === "empty") return null;
        return JSON.stringify({ state: merged, version });
      } catch (e) {
        // 读写异常不阻塞启动：返回 null 让 persist 用默认状态，同时留诊断
        reportDiagnostic({
          kind: "rehydrate-failed",
          message: e instanceof Error ? e.message : "持久化读取失败",
        });
        return null;
      }
    },

    async setItem(_name: string, value: string): Promise<void> {
      let parsed: Record<string, unknown> | null = null;
      try {
        const raw = JSON.parse(value);
        parsed = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
      } catch {
        reportDiagnostic({ kind: "write-parse-failed", message: "持久化写入内容不是合法 JSON，本次写入已跳过" });
        return;
      }
      const state = stateOf(parsed) ?? {};
      const { light, heavy } = splitPersistedState(state);
      // token 永不落 AsyncStorage（只在 expo-secure-store）
      light.token = null;
      // zustand persist 的 setItem 是 fire-and-forget：连续多次 set 会并发写同一个 key。
      // 这里串行化，保证「后一次快照」一定覆盖「前一次」，不会因 AsyncStorage 完成顺序乱序写回旧数据。
      const write = writeChain.then(async () => {
        try {
          const result = await writeSlices(light, heavy, false);
          reportWrite("split", result);
        } catch (e) {
          reportDiagnostic({
            kind: "write-failed",
            message: e instanceof Error ? e.message : "持久化写入失败",
            data: { lightBytes: utf8ByteLength(JSON.stringify(light)), heavyBytes: utf8ByteLength(JSON.stringify(heavy)) },
          });
        }
      });
      writeChain = write.catch(() => undefined);
      await write;
    },

    async removeItem(_name: string): Promise<void> {
      lastLightJson = null;
      lastHeavyJson = null;
      await Promise.all([
        AsyncStorage.removeItem(LIGHT_STORAGE_KEY),
        AsyncStorage.removeItem(HEAVY_STORAGE_KEY),
      ]);
    },
  };
}

/** 等待当前所有排队中的写盘完成（测试 / 退后台前 flush 用） */
export async function flushPersistWrites(): Promise<void> {
  await writeChain;
}

/** onRehydrateStorage 回调里调用：上报恢复结果（条数/体积/是否超限/错误） */
export function reportRehydrate(state: PersistedSlice | null | undefined, error: unknown): void {
  // 首次安装 / 无历史数据：不打扰（没有可上报的"恢复结果"）
  if (!state && !error) return;
  if (getLastPersistReport()?.source === "empty") return;
  if (error) {
    reportDiagnostic({
      kind: "rehydrate-error",
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  const summary = summarizeRehydratedState(state);
  if (isHeavyWriteOverBudget(summary.heavyBytes)) {
    reportDiagnostic({
      kind: "rehydrate-over-budget",
      message: describeRehydrateSummary(summary),
      data: { ...summary },
    });
    return;
  }
  reportDiagnostic({
    kind: "rehydrate",
    message: describeRehydrateSummary(summary),
    data: { ...summary },
  });
}
