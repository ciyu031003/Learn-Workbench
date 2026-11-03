import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  aggregateSleepHours,
  countSessionsInWindow,
  formatSleepHours,
  formatSleepHoursValue,
  isFreshSleepEntry,
  lastNightWindow,
  loadSleepEntry,
  normalizeSleepEntry,
  openSleepSettings,
  parseSleepHoursInput,
  readSleepFromHealth,
  roundSleepHours,
  saveSleepEntry,
  sleepEntryDateKey,
  sleepHoursInWindow,
  SLEEP_STORAGE_KEY,
  type SleepSession,
} from "./sleep";

// AsyncStorage / react-native / 原生模块全部 mock：
// 这个文件只测「纯函数 + 降级链路」，真机读取留给真机验证。
const mem = vi.hoisted(() => ({ map: new Map<string, string>() }));

const hc = vi.hoisted(() => ({
  platform: { OS: "android" },
  getSdkStatus: vi.fn(async () => 3),
  initialize: vi.fn(async () => true),
  getGrantedPermissions: vi.fn(async () => [{ accessType: "read", recordType: "SleepSession" }]),
  requestPermission: vi.fn(async () => [{ accessType: "read", recordType: "SleepSession" }]),
  readRecords: vi.fn(async (): Promise<{ records: { startTime: string; endTime: string }[] }> => ({ records: [] })),
  openHealthConnectSettings: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => mem.map.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      mem.map.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      mem.map.delete(key);
    }),
  },
}));

vi.mock("react-native", () => ({ Platform: hc.platform }));

vi.mock("react-native-health-connect", () => ({
  SdkAvailabilityStatus: { SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2, SDK_AVAILABLE: 3 },
  getSdkStatus: hc.getSdkStatus,
  initialize: hc.initialize,
  getGrantedPermissions: hc.getGrantedPermissions,
  requestPermission: hc.requestPermission,
  readRecords: hc.readRecords,
  openHealthConnectSettings: hc.openHealthConnectSettings,
}));



/** 本地时间 → ISO（与设备时区一致，窗口计算也是本地时间） */
function ts(y: number, mo: number, d: number, h: number, mi = 0): string {
  return new Date(y, mo - 1, d, h, mi).toISOString();
}

function session(startTime: string, endTime: string): SleepSession {
  return { startTime, endTime };
}

/** 测试基准时刻：2026-03-10 09:00（本地） */
const NOW = new Date(2026, 2, 10, 9, 0, 0);

beforeEach(() => {
  mem.map.clear();
  hc.platform.OS = "android";
  hc.getSdkStatus.mockReset();
  hc.getSdkStatus.mockResolvedValue(3);
  hc.initialize.mockReset();
  hc.initialize.mockResolvedValue(true);
  hc.getGrantedPermissions.mockReset();
  hc.getGrantedPermissions.mockResolvedValue([{ accessType: "read", recordType: "SleepSession" }]);
  hc.requestPermission.mockReset();
  hc.requestPermission.mockResolvedValue([{ accessType: "read", recordType: "SleepSession" }]);
  hc.readRecords.mockReset();
  hc.readRecords.mockResolvedValue({ records: [] });
  hc.openHealthConnectSettings.mockReset();
});

describe("aggregateSleepHours（聚合总时长）", () => {
  it("空/null/非法入参都返回 0", () => {
    expect(aggregateSleepHours([])).toBe(0);
    expect(aggregateSleepHours(null)).toBe(0);
    expect(aggregateSleepHours(undefined)).toBe(0);
  });

  it("单段 7.5 小时", () => {
    expect(aggregateSleepHours([session(ts(2026, 3, 9, 23, 30), ts(2026, 3, 10, 7, 0))])).toBe(7.5);
  });

  it("跨天单段按真实时长计（23:00 → 07:00 = 8 小时）", () => {
    expect(aggregateSleepHours([session(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0))])).toBe(8);
  });

  it("多段相加（2 + 3.5 = 5.5）", () => {
    const sessions = [
      session(ts(2026, 3, 9, 22, 0), ts(2026, 3, 10, 0, 0)),
      session(ts(2026, 3, 10, 0, 0), ts(2026, 3, 10, 3, 30)),
    ];
    expect(aggregateSleepHours(sessions)).toBe(5.5);
  });

  it("异常时长（结束早于开始 / 超过 24 小时 / 时间串非法）被丢弃", () => {
    const sessions = [
      session(ts(2026, 3, 10, 7, 0), ts(2026, 3, 9, 23, 0)), // 负时长
      session(ts(2026, 3, 8, 8, 0), ts(2026, 3, 10, 9, 0)), // 49 小时
      session("not-a-date", ts(2026, 3, 10, 7, 0)),
      session(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0)), // 唯一合法的一条
    ];
    expect(aggregateSleepHours(sessions)).toBe(8);
  });

  it("总量封顶 24 小时（多段脏数据叠加也不会撑爆指标）", () => {
    const sessions = [
      session(ts(2026, 3, 8, 0, 0), ts(2026, 3, 9, 0, 0)),
      session(ts(2026, 3, 9, 0, 0), ts(2026, 3, 10, 0, 0)),
    ];
    expect(aggregateSleepHours(sessions)).toBe(24);
  });
});

describe("lastNightWindow（昨晚窗口）", () => {
  it("昨天 18:00 → 今天 12:00", () => {
    const window = lastNightWindow(NOW);
    expect(window.start.getTime()).toBe(new Date(2026, 2, 9, 18, 0).getTime());
    expect(window.end.getTime()).toBe(new Date(2026, 2, 10, 12, 0).getTime());
  });

  it("凌晨（02:00）仍指向前一晚的 18:00", () => {
    const window = lastNightWindow(new Date(2026, 2, 10, 2, 0));
    expect(window.start.getTime()).toBe(new Date(2026, 2, 9, 18, 0).getTime());
    expect(window.end.getTime()).toBe(new Date(2026, 2, 10, 12, 0).getTime());
  });
});

describe("sleepHoursInWindow（只算窗口内部分）", () => {
  const window = lastNightWindow(NOW);

  it("跨天整段睡眠：23:30 → 07:00 = 7.5", () => {
    expect(sleepHoursInWindow([session(ts(2026, 3, 9, 23, 30), ts(2026, 3, 10, 7, 0))], window)).toBe(7.5);
  });

  it("窗口前开始：17:00 → 23:00 只计 18:00 后的 5 小时", () => {
    expect(sleepHoursInWindow([session(ts(2026, 3, 9, 17, 0), ts(2026, 3, 9, 23, 0))], window)).toBe(5);
  });

  it("窗口后结束：10:00 → 13:00 只计到 12:00 的 2 小时", () => {
    expect(sleepHoursInWindow([session(ts(2026, 3, 10, 10, 0), ts(2026, 3, 10, 13, 0))], window)).toBe(2);
  });

  it("昨天白天的补觉（14:00 → 15:00）不算昨晚", () => {
    expect(sleepHoursInWindow([session(ts(2026, 3, 9, 14, 0), ts(2026, 3, 9, 15, 0))], window)).toBe(0);
  });

  it("多段求和（6 + 1.5 = 7.5）", () => {
    const sessions = [
      session(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 5, 0)),
      session(ts(2026, 3, 10, 5, 30), ts(2026, 3, 10, 7, 0)),
    ];
    expect(sleepHoursInWindow(sessions, window)).toBe(7.5);
    expect(countSessionsInWindow(sessions, window)).toBe(2);
  });

  it("空/脏数据返回 0", () => {
    expect(sleepHoursInWindow([], window)).toBe(0);
    expect(sleepHoursInWindow([session("", "")], window)).toBe(0);
  });
});

describe("格式化", () => {
  it("指标格数值：null → 「—」，保留 1 位小数", () => {
    expect(formatSleepHoursValue(null)).toBe("—");
    expect(formatSleepHoursValue(undefined)).toBe("—");
    expect(formatSleepHoursValue(7.5)).toBe("7.5");
    expect(formatSleepHoursValue(8)).toBe("8");
    expect(formatSleepHoursValue(7.46)).toBe("7.5");
  });

  it("正文文案：「X 小时」", () => {
    expect(formatSleepHours(7.5)).toBe("7.5 小时");
    expect(formatSleepHours(0)).toBe("0 小时");
    expect(formatSleepHours(null)).toBe("—");
  });

  it("roundSleepHours 夹到 [0,24] 且保留 1 位小数", () => {
    expect(roundSleepHours(-3)).toBe(0);
    expect(roundSleepHours(30)).toBe(24);
    expect(roundSleepHours(7.44)).toBe(7.4);
    expect(roundSleepHours(Number.NaN)).toBe(0);
  });
});

describe("parseSleepHoursInput（手动输入）", () => {
  it("小数与逗号小数", () => {
    expect(parseSleepHoursInput("7.5")).toBe(7.5);
    expect(parseSleepHoursInput("7,5")).toBe(7.5);
    expect(parseSleepHoursInput(" 8 ")).toBe(8);
  });

  it("时钟写法 7:30 → 7.5", () => {
    expect(parseSleepHoursInput("7:30")).toBe(7.5);
    expect(parseSleepHoursInput("6:45")).toBe(6.8);
    expect(parseSleepHoursInput("12:75")).toBeNull();
  });

  it("带单位与中文写法", () => {
    expect(parseSleepHoursInput("7小时")).toBe(7);
    expect(parseSleepHoursInput("7 个小时")).toBe(7);
    expect(parseSleepHoursInput("7h")).toBe(7);
  });

  it("空/非法/超范围 → null", () => {
    expect(parseSleepHoursInput("")).toBeNull();
    expect(parseSleepHoursInput("   ")).toBeNull();
    expect(parseSleepHoursInput("abc")).toBeNull();
    expect(parseSleepHoursInput("0")).toBeNull();
    expect(parseSleepHoursInput("-1")).toBeNull();
    expect(parseSleepHoursInput("24.5")).toBeNull();
    expect(parseSleepHoursInput("25")).toBeNull();
  });
});

describe("本机存档", () => {
  it("日期键是本地日期", () => {
    expect(sleepEntryDateKey(NOW)).toBe("2026-03-10");
  });

  it("normalizeSleepEntry 收敛脏数据", () => {
    expect(normalizeSleepEntry(null)).toBeNull();
    expect(normalizeSleepEntry({ date: "2026-03-10" })).toBeNull();
    expect(normalizeSleepEntry({ date: "2026/03/10", hours: 7 })).toBeNull();
    expect(normalizeSleepEntry({ date: "2026-03-10", hours: 0 })).toBeNull();
    expect(normalizeSleepEntry({ date: "2026-03-10", hours: "7" })).toBeNull();
    const ok = normalizeSleepEntry({ date: "2026-03-10", hours: 7.46, source: "health" });
    expect(ok).toEqual({ date: "2026-03-10", hours: 7.5, source: "health", updatedAt: expect.any(String) });
    // 未知来源兜底为手动
    expect(normalizeSleepEntry({ date: "2026-03-10", hours: 6, source: "x" })?.source).toBe("manual");
  });

  it("保存 → 读取 往返；坏 JSON 当作没有", async () => {
    const saved = await saveSleepEntry({ date: "2026-03-10", hours: 7.5, source: "manual" });
    expect(saved?.hours).toBe(7.5);
    expect(mem.map.has(SLEEP_STORAGE_KEY)).toBe(true);
    const loaded = await loadSleepEntry();
    expect(loaded).toEqual(expect.objectContaining({ date: "2026-03-10", hours: 7.5, source: "manual" }));

    mem.map.set(SLEEP_STORAGE_KEY, "{not json");
    expect(await loadSleepEntry()).toBeNull();
    expect(await loadSleepEntry()).toBeNull();
  });

  it("isFreshSleepEntry：今天/昨天算新鲜，更早的不算", () => {
    const entry = { date: "2026-03-10", hours: 7.5, source: "manual" as const, updatedAt: "x" };
    expect(isFreshSleepEntry(entry, "2026-03-10", "2026-03-09")).toBe(true);
    expect(isFreshSleepEntry({ ...entry, date: "2026-03-09" }, "2026-03-10", "2026-03-09")).toBe(true);
    expect(isFreshSleepEntry({ ...entry, date: "2026-03-08" }, "2026-03-10", "2026-03-09")).toBe(false);
    expect(isFreshSleepEntry(null, "2026-03-10", "2026-03-09")).toBe(false);
  });
});

describe("readSleepFromHealth（降级链路，永不抛）", () => {
  it("读到昨晚睡眠：按窗口聚合后返回小时数", async () => {
    hc.readRecords.mockResolvedValue({
      records: [
        { startTime: ts(2026, 3, 9, 23, 30), endTime: ts(2026, 3, 10, 7, 0) },
        { startTime: ts(2026, 3, 9, 14, 0), endTime: ts(2026, 3, 9, 15, 0) }, // 白天补觉，不算
      ],
    });
    const result = await readSleepFromHealth({ now: NOW });
    expect(result).toEqual({ ok: true, status: "ok", hours: 7.5, sessions: 1 });
  });

  it("非 Android → unsupported（不 import 原生模块）", async () => {
    hc.platform.OS = "ios";
    const result = await readSleepFromHealth({ now: NOW });
    expect(result).toEqual({ ok: false, status: "unsupported", hours: null, sessions: 0 });
    expect(hc.getSdkStatus).not.toHaveBeenCalled();
  });

  it("本机没有 Health Connect → unavailable", async () => {
    hc.getSdkStatus.mockResolvedValue(1);
    expect((await readSleepFromHealth({ now: NOW })).status).toBe("unavailable");
  });

  it("初始化失败 → unavailable", async () => {
    hc.initialize.mockResolvedValue(false);
    expect((await readSleepFromHealth({ now: NOW })).status).toBe("unavailable");
  });

  it("未授权且不主动申请 → denied（自动读取不弹系统框）", async () => {
    hc.getGrantedPermissions.mockResolvedValue([]);
    expect((await readSleepFromHealth({ now: NOW })).status).toBe("denied");
    expect(hc.requestPermission).not.toHaveBeenCalled();
  });

  it("未授权 + 用户点了去授权：申请后授予则继续读", async () => {
    hc.getGrantedPermissions.mockResolvedValueOnce([]).mockResolvedValue([{ accessType: "read", recordType: "SleepSession" }]);
    hc.readRecords.mockResolvedValue({
      records: [{ startTime: ts(2026, 3, 10, 0, 0), endTime: ts(2026, 3, 10, 7, 0) }],
    });
    const result = await readSleepFromHealth({ now: NOW, requestPermission: true });
    expect(hc.requestPermission).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, status: "ok", hours: 7, sessions: 1 });
  });

  it("申请后仍未授权 → denied", async () => {
    hc.getGrantedPermissions.mockResolvedValue([]);
    hc.requestPermission.mockResolvedValue([]);
    expect((await readSleepFromHealth({ now: NOW, requestPermission: true })).status).toBe("denied");
  });

  it("有权限但没有记录 → no-data", async () => {
    expect((await readSleepFromHealth({ now: NOW })).status).toBe("no-data");
  });

  it("读取抛错/超时 → error（不冒泡）", async () => {
    hc.readRecords.mockRejectedValue(new Error("boom"));
    expect((await readSleepFromHealth({ now: NOW })).status).toBe("error");
    hc.readRecords.mockReset();
    hc.readRecords.mockImplementation(() => new Promise(() => {})); // 永不 resolve
    expect((await readSleepFromHealth({ now: NOW, timeoutMs: 20 })).status).toBe("error");
  });

  it("openSleepSettings：Android 走原生开关，异常时返回 false", async () => {
    expect(await openSleepSettings()).toBe(true);
    expect(hc.openHealthConnectSettings).toHaveBeenCalledTimes(1);
    hc.openHealthConnectSettings.mockImplementation(() => {
      throw new Error("no activity");
    });
    expect(await openSleepSettings()).toBe(false);
    hc.platform.OS = "ios";
    expect(await openSleepSettings()).toBe(false);
  });
});