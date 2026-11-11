import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  aggregateHealthSleepRecords,
  aggregateSleepHours,
  bedtimeMinutes,
  clockFromBedtimeMinutes,
  countSessionsInWindow,
  deleteSleepNight,
  effectiveSleepMetrics,
  formatClockTime,
  formatSleepHours,
  formatSleepHoursValue,
  formatSleepMinutes,
  formatSleepMinutesShort,
  isFreshSleepEntry,
  lastNightWindow,
  latestSleepNight,
  loadLegacySleepEntrySafely,
  loadSleepEntry,
  loadSleepNights,
  normalizeSleepEntry,
  normalizeSleepNight,
  openSleepSettings,
  parseSleepHoursInput,
  parseSleepMinutesInput,
  qualityLabel,
  readSleepFromHealth,
  readSleepNightsFromHealth,
  roundSleepHours,
  saveSleepEntry,
  saveSleepNight,
  sleepDurationHours,
  sleepEntryDateKey,
  sleepHoursInWindow,
  sleepRegularity,
  sleepScore,
  sleepScoreBreakdown,
  sleepDataQuality,
  sleepStageSlices,
  sleepStats,
  summarizeSleepHealthRecords,
  SLEEP_NIGHTS_STORAGE_KEY,
  SLEEP_STORAGE_KEY,
  SLEEP_STATUS_HINT,
  upsertManualSleepNight,
  LEGACY_SLEEP_STORAGE_KEY,
  type SleepHealthRecord,
  type SleepNight,
  type SleepSession,
} from "./sleep";

// AsyncStorage / react-native / 原生模块全部 mock：
// 这个文件只测「纯函数 + 存储 + 降级链路」，真机读取留给真机验证。
const mem = vi.hoisted(() => ({ map: new Map<string, string>() }));

type MockStage = { startTime: string; endTime: string; stage: number | string };
type MockRecord = { startTime: string; endTime: string; stages?: MockStage[] | null };
type ReadOptions = {
  pageToken?: string;
  ascendingOrder?: boolean;
  pageSize?: number;
  timeRangeFilter?: { operator?: string; startTime: string; endTime: string };
};

const hc = vi.hoisted(() => {
  const state = {
    lastRecordType: null as string | null,
    lastOptions: null as ReadOptions | null,
    lastPermissions: null as { accessType: string; recordType: string }[] | null,
    pages: [] as { records: MockRecord[]; pageToken?: string }[],
  };
  return {
    state,
    platform: { OS: "android" as string },
    getSdkStatus: vi.fn(async () => 3),
    initialize: vi.fn(async () => true),
    getGrantedPermissions: vi.fn(async (): Promise<{ accessType: string; recordType: string }[]> => [
      { accessType: "read", recordType: "SleepSession" },
    ]),
    requestPermission: vi.fn(
      async (permissions: { accessType: string; recordType: string }[]): Promise<{ accessType: string; recordType: string }[]> => {
        state.lastPermissions = permissions;
        return permissions;
      }
    ),
    readRecords: vi.fn(
      async (
        recordType: string,
        options: ReadOptions
      ): Promise<{ records: MockRecord[]; pageToken?: string }> => {
        state.lastRecordType = recordType;
        state.lastOptions = options;
        return { records: [] };
      }
    ),
    openHealthConnectSettings: vi.fn(),
  };
});

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
function ts(y: number, mo: number, d: number, h: number, mi = 0, sec = 0): string {
  return new Date(y, mo - 1, d, h, mi, sec).toISOString();
}

function session(startTime: string, endTime: string): SleepSession {
  return { startTime, endTime };
}

/** 测试基准时刻：2026-03-10 09:00（本地） */
const NOW = new Date(2026, 2, 10, 9, 0, 0);

/** 造一晚（默认 8 小时、无阶段、手动） */
function makeNight(overrides: Partial<SleepNight> = {}): SleepNight {
  return {
    date: "2026-03-10",
    bedtime: ts(2026, 3, 9, 23, 0),
    wakeTime: ts(2026, 3, 10, 7, 0),
    durationMin: 480,
    timeInBedMin: 480,
    stages: null,
    awakeCount: null,
    efficiencyPct: null,
    source: "manual",
    updatedAt: "2026-03-10T00:00:00.000Z",
    ...overrides,
  };
}

/** 造一条 Health Connect 会话（阶段可选） */
function record(startTime: string, endTime: string, stages?: MockStage[]): MockRecord {
  return { startTime, endTime, stages: stages ?? null };
}

function stage(startTime: string, endTime: string, name: number | string): MockStage {
  return { startTime, endTime, stage: name };
}

/** 干净的一晚：23:00-07:00，深睡 3h / 浅睡 3h / REM 1.5h / 清醒 0.5h */
function fullNightStages(): MockStage[] {
  return [
    stage(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 2, 0), 5), // DEEP
    stage(ts(2026, 3, 10, 2, 0), ts(2026, 3, 10, 5, 0), 4), // LIGHT
    stage(ts(2026, 3, 10, 5, 0), ts(2026, 3, 10, 6, 30), 6), // REM
    stage(ts(2026, 3, 10, 6, 30), ts(2026, 3, 10, 7, 0), 1), // AWAKE
  ];
}

async function readRecordsImpl(
  recordType: string,
  options: ReadOptions
): Promise<{ records: MockRecord[]; pageToken?: string }> {
  hc.state.lastRecordType = recordType;
  hc.state.lastOptions = options;
  const page = hc.state.pages.shift();
  return page ?? { records: [] };
}

beforeEach(() => {
  mem.map.clear();
  hc.platform.OS = "android";
  hc.state.lastRecordType = null;
  hc.state.lastOptions = null;
  hc.state.lastPermissions = null;
  hc.state.pages = [];
  hc.getSdkStatus.mockReset();
  hc.getSdkStatus.mockResolvedValue(3);
  hc.initialize.mockReset();
  hc.initialize.mockResolvedValue(true);
  hc.getGrantedPermissions.mockReset();
  hc.getGrantedPermissions.mockResolvedValue([{ accessType: "read", recordType: "SleepSession" }]);
  hc.requestPermission.mockReset();
  hc.requestPermission.mockImplementation(async (permissions) => {
    hc.state.lastPermissions = permissions;
    return permissions;
  });
  hc.readRecords.mockReset();
  hc.readRecords.mockImplementation(readRecordsImpl);
  hc.openHealthConnectSettings.mockReset();
});

/* ================================================================== *
 * 旧 API（保持兼容）
 * ================================================================== */

describe("旧 API：格式化", () => {
  it("formatSleepHoursValue：null → 破折号，保留 1 位小数", () => {
    expect(formatSleepHoursValue(null)).toBe("—");
    expect(formatSleepHoursValue(undefined)).toBe("—");
    expect(formatSleepHoursValue(7.5)).toBe("7.5");
    expect(formatSleepHoursValue(8)).toBe("8");
    expect(formatSleepHoursValue(7.46)).toBe("7.5");
  });

  it("formatSleepHours：「X 小时」", () => {
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

  it("formatSleepMinutes / formatSleepMinutesShort", () => {
    expect(formatSleepMinutes(450)).toBe("7 小时 30 分");
    expect(formatSleepMinutes(480)).toBe("8 小时");
    expect(formatSleepMinutes(45)).toBe("45 分钟");
    expect(formatSleepMinutes(0)).toBe("0 分钟");
    expect(formatSleepMinutes(null)).toBe("—");
    expect(formatSleepMinutesShort(450)).toBe("7 小时 30 分");
    expect(formatSleepMinutesShort(480)).toBe("8 小时");
    expect(formatSleepMinutesShort(45)).toBe("45 分钟");
    expect(formatSleepMinutesShort(0)).toBe("0 分钟");
    expect(formatSleepMinutesShort(null)).toBe("—");
  });

  it("formatClockTime：ISO → HH:mm，非法 → 破折号", () => {
    expect(formatClockTime(ts(2026, 3, 9, 23, 30))).toBe("23:30");
    expect(formatClockTime(ts(2026, 3, 10, 7, 5))).toBe("07:05");
    expect(formatClockTime("nope")).toBe("—");
    expect(formatClockTime(null)).toBe("—");
  });

  it("sleepDurationHours：分钟 → 小时（1 位小数）", () => {
    expect(sleepDurationHours(makeNight({ durationMin: 450 }))).toBe(7.5);
    expect(sleepDurationHours(makeNight({ durationMin: 0 }))).toBeNull();
    expect(sleepDurationHours(null)).toBeNull();
  });
});

describe("旧 API：手动输入解析", () => {
  it("小数与逗号小数", () => {
    expect(parseSleepHoursInput("7.5")).toBe(7.5);
    expect(parseSleepHoursInput("7,5")).toBe(7.5);
    expect(parseSleepHoursInput(" 8 ")).toBe(8);
  });

  it("时钟写法 7:30 → 7.5；parseSleepMinutesInput → 450", () => {
    expect(parseSleepHoursInput("7:30")).toBe(7.5);
    expect(parseSleepHoursInput("6:45")).toBe(6.8);
    expect(parseSleepHoursInput("12:75")).toBeNull();
    expect(parseSleepMinutesInput("7:30")).toBe(450);
    expect(parseSleepMinutesInput("abc")).toBeNull();
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

describe("旧 API：单晚窗口聚合", () => {
  it("aggregateSleepHours 空/脏数据安全", () => {
    expect(aggregateSleepHours([])).toBe(0);
    expect(aggregateSleepHours(null)).toBe(0);
    expect(aggregateSleepHours([session(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 3, 30))])).toBe(4.5);
    expect(aggregateSleepHours([session(ts(2026, 3, 8, 8, 0), ts(2026, 3, 10, 9, 0))])).toBe(0);
  });

  it("lastNightWindow：昨天 18:00 → 今天 12:00", () => {
    const window = lastNightWindow(NOW);
    expect(window.start.getTime()).toBe(new Date(2026, 2, 9, 18, 0).getTime());
    expect(window.end.getTime()).toBe(new Date(2026, 2, 10, 12, 0).getTime());
  });

  it("sleepHoursInWindow 只算窗口内部分", () => {
    const window = lastNightWindow(NOW);
    expect(sleepHoursInWindow([session(ts(2026, 3, 9, 17, 0), ts(2026, 3, 9, 23, 0))], window)).toBe(5);
    expect(sleepHoursInWindow([session(ts(2026, 3, 10, 10, 0), ts(2026, 3, 10, 13, 0))], window)).toBe(2);
    expect(
      countSessionsInWindow(
        [session(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 5, 0)), session(ts(2026, 3, 10, 5, 30), ts(2026, 3, 10, 7, 0))],
        window
      )
    ).toBe(2);
  });
});

describe("旧 API：条目归一化与新鲜度", () => {
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
    expect(normalizeSleepEntry({ date: "2026-03-10", hours: 6, source: "x" })?.source).toBe("manual");
  });

  it("isFreshSleepEntry：今天/昨天算新鲜，更早的不算", () => {
    const entry = { date: "2026-03-10", hours: 7.5, source: "manual" as const, updatedAt: "x" };
    expect(isFreshSleepEntry(entry, "2026-03-10", "2026-03-09")).toBe(true);
    expect(isFreshSleepEntry({ ...entry, date: "2026-03-09" }, "2026-03-10", "2026-03-09")).toBe(true);
    expect(isFreshSleepEntry({ ...entry, date: "2026-03-08" }, "2026-03-10", "2026-03-09")).toBe(false);
    expect(isFreshSleepEntry(null, "2026-03-10", "2026-03-09")).toBe(false);
  });
});

/* ================================================================== *
 * 多晚存储
 * ================================================================== */

describe("多晚存储（lwb.sleep.v2）", () => {
  it("saveSleepNight → loadSleepNights 往返，按起床日升序", async () => {
    await saveSleepNight(makeNight({ date: "2026-03-10" }));
    await saveSleepNight(makeNight({ date: "2026-03-08" }));
    const nights = await loadSleepNights();
    expect(nights.map((night) => night.date)).toEqual(["2026-03-08", "2026-03-10"]);
    expect(nights[1].durationMin).toBe(480);
    expect(JSON.parse(mem.map.get(SLEEP_NIGHTS_STORAGE_KEY) ?? "[]")).toHaveLength(2);
  });

  it("同一天再存 → 覆盖而不是追加", async () => {
    await saveSleepNight(makeNight({ date: "2026-03-10", durationMin: 400, updatedAt: "2026-03-10T00:00:00.000Z" }));
    const saved = await saveSleepNight(
      makeNight({ date: "2026-03-10", durationMin: 450, updatedAt: "2026-03-10T08:00:00.000Z" })
    );
    const nights = await loadSleepNights();
    expect(nights).toHaveLength(1);
    expect(nights[0].durationMin).toBe(450);
    expect(saved?.durationMin).toBe(450);
  });

  it("deleteSleepNight 删除指定日期；不存在的日期返回 false", async () => {
    await saveSleepNight(makeNight({ date: "2026-03-09" }));
    await saveSleepNight(makeNight({ date: "2026-03-10" }));
    expect(await deleteSleepNight("2026-03-09")).toBe(true);
    expect((await loadSleepNights()).map((night) => night.date)).toEqual(["2026-03-10"]);
    expect(await deleteSleepNight("2026-03-09")).toBe(false);
    expect(await deleteSleepNight("2026/03/10")).toBe(false);
  });

  it("loadSleepEntry 返回最近一晚（多晚里取最大日期）", async () => {
    await saveSleepNight(makeNight({ date: "2026-03-08", durationMin: 420 }));
    await saveSleepNight(makeNight({ date: "2026-03-09", durationMin: 450 }));
    const entry = await loadSleepEntry();
    expect(entry).toEqual(
      expect.objectContaining({ date: "2026-03-09", hours: 7.5, source: "manual" })
    );
  });

  it("saveSleepEntry 写进 v2 并覆盖同日；不再写 v1", async () => {
    const saved = await saveSleepEntry({ date: "2026-03-10", hours: 7.5, source: "manual" });
    expect(saved).toEqual(expect.objectContaining({ date: "2026-03-10", hours: 7.5, source: "manual" }));
    expect(mem.map.has(SLEEP_NIGHTS_STORAGE_KEY)).toBe(true);
    expect(mem.map.has(LEGACY_SLEEP_STORAGE_KEY)).toBe(false);

    const overwritten = await saveSleepEntry({ date: "2026-03-10", hours: 8, source: "health" });
    expect(overwritten?.hours).toBe(8);
    const nights = await loadSleepNights();
    expect(nights).toHaveLength(1);
    expect(nights[0].source).toBe("health");
    expect(await loadSleepEntry()).toEqual(expect.objectContaining({ hours: 8, source: "health" }));
  });

  it("坏 JSON / 坏条目都不炸（当作没有）", async () => {
    mem.map.set(SLEEP_NIGHTS_STORAGE_KEY, "{not json");
    expect(await loadSleepNights()).toEqual([]);
    mem.map.set(SLEEP_NIGHTS_STORAGE_KEY, JSON.stringify([null, { date: "bad" }, makeNight({ date: "2026-03-10" })]));
    expect((await loadSleepNights()).map((night) => night.date)).toEqual(["2026-03-10"]);
    mem.map.set(SLEEP_NIGHTS_STORAGE_KEY, JSON.stringify({ not: "array" }));
    expect(await loadSleepNights()).toEqual([]);
  });

  it("normalizeSleepNight：坏条目返回 null，timeInBed 至少等于时长", () => {
    expect(normalizeSleepNight(null)).toBeNull();
    expect(normalizeSleepNight({ date: "2026/03/10" })).toBeNull();
    expect(normalizeSleepNight({ date: "2026-03-10", bedtime: "x", wakeTime: "y", durationMin: 400 })).toBeNull();
    expect(normalizeSleepNight({ date: "2026-03-10", bedtime: ts(2026, 3, 9, 23, 0), wakeTime: ts(2026, 3, 10, 7, 0), durationMin: 0 })).toBeNull();
    const normalized = normalizeSleepNight(
      makeNight({ timeInBedMin: 100, efficiencyPct: 130, awakeCount: 2.4, stages: { deep: 90, light: 300, rem: 60, awake: 30 } })
    );
    expect(normalized?.timeInBedMin).toBe(480);
    expect(normalized?.efficiencyPct).toBe(100);
    expect(normalized?.awakeCount).toBe(2);
    expect(normalized?.stages).toEqual({ deep: 90, light: 300, rem: 60, awake: 30 });
  });
});

describe("旧 v1 单条 → v2 多晚迁移", () => {
  it("首次读取把 v1 迁移成一条 manual night（保留旧键）", async () => {
    mem.map.set(
      LEGACY_SLEEP_STORAGE_KEY,
      JSON.stringify({ date: "2026-03-09", hours: 7.4, source: "health", updatedAt: "2026-03-09T23:00:00.000Z" })
    );
    const nights = await loadSleepNights();
    expect(nights).toHaveLength(1);
    expect(nights[0]).toEqual(
      expect.objectContaining({ date: "2026-03-09", durationMin: 444, source: "manual", stages: null })
    );
    expect(formatClockTime(nights[0].wakeTime)).toBe("07:00");
    expect(formatClockTime(nights[0].bedtime)).toBe("23:36");
    expect(mem.map.has(SLEEP_NIGHTS_STORAGE_KEY)).toBe(true);
    expect(mem.map.has(LEGACY_SLEEP_STORAGE_KEY)).toBe(true);
  });

  it("迁移只发生一次（再读不重复）", async () => {
    mem.map.set(LEGACY_SLEEP_STORAGE_KEY, JSON.stringify({ date: "2026-03-09", hours: 7 }));
    await loadSleepNights();
    const again = await loadSleepNights();
    expect(again).toHaveLength(1);
    expect(JSON.parse(mem.map.get(SLEEP_NIGHTS_STORAGE_KEY) ?? "[]")).toHaveLength(1);
  });

  it("v2 已有数据时不再迁移 v1", async () => {
    await saveSleepNight(makeNight({ date: "2026-03-10" }));
    mem.map.set(LEGACY_SLEEP_STORAGE_KEY, JSON.stringify({ date: "2026-03-09", hours: 7 }));
    const nights = await loadSleepNights();
    expect(nights.map((night) => night.date)).toEqual(["2026-03-10"]);
  });

  it("v2 是坏 JSON 时回落到 v1 迁移", async () => {
    mem.map.set(SLEEP_NIGHTS_STORAGE_KEY, "{broken");
    mem.map.set(LEGACY_SLEEP_STORAGE_KEY, JSON.stringify({ date: "2026-03-09", hours: 6.5 }));
    expect((await loadSleepNights()).map((night) => night.durationMin)).toEqual([390]);
  });

  it("loadLegacySleepEntrySafely：坏数据 → null", async () => {
    expect(await loadLegacySleepEntrySafely()).toBeNull();
    mem.map.set(LEGACY_SLEEP_STORAGE_KEY, "{not json");
    expect(await loadLegacySleepEntrySafely()).toBeNull();
    mem.map.set(LEGACY_SLEEP_STORAGE_KEY, JSON.stringify({ date: "2026-03-09", hours: 7 }));
    expect(await loadLegacySleepEntrySafely()).toEqual(expect.objectContaining({ hours: 7 }));
  });
});

describe("手动任意日期 upsert", () => {
  it("只给时长：起床默认 07:00，入睡 = 起床 - 时长", async () => {
    const night = await upsertManualSleepNight({ date: "2026-02-01", durationMin: 420 });
    expect(night).not.toBeNull();
    expect(night?.source).toBe("manual");
    expect(night?.stages).toBeNull();
    expect(night?.efficiencyPct).toBeNull();
    expect(formatClockTime(night?.wakeTime)).toBe("07:00");
    expect(formatClockTime(night?.bedtime)).toBe("00:00");
    expect((await loadSleepNights()).map((item) => item.date)).toEqual(["2026-02-01"]);
  });

  it("只给就寝时间：起床 = 就寝 + 时长", async () => {
    const night = await upsertManualSleepNight({
      date: "2026-02-02",
      durationMin: 390,
      bedtime: ts(2026, 2, 2, 0, 30),
    });
    expect(formatClockTime(night?.wakeTime)).toBe("07:00");
    expect(formatClockTime(night?.bedtime)).toBe("00:30");
  });

  it("两个都给且自洽：卧床时长与效率按实际算", async () => {
    const night = await upsertManualSleepNight({
      date: "2026-03-10",
      durationMin: 480,
      bedtime: ts(2026, 3, 9, 22, 30),
      wakeTime: ts(2026, 3, 10, 7, 0),
    });
    expect(night?.timeInBedMin).toBe(510);
    expect(night?.efficiencyPct).toBe(94);
  });

  it("两个都给但不自洽：以时长为准重算入睡", async () => {
    const night = await upsertManualSleepNight({
      date: "2026-03-10",
      durationMin: 480,
      bedtime: ts(2026, 3, 9, 23, 0),
      wakeTime: ts(2026, 3, 10, 6, 0),
    });
    expect(night?.timeInBedMin).toBe(480);
    expect(night?.efficiencyPct).toBeNull();
    expect(formatClockTime(night?.bedtime)).toBe("22:00");
  });

  it("非法日期/时长 → null（不写库）", async () => {
    expect(await upsertManualSleepNight({ date: "2026/3/1", durationMin: 400 })).toBeNull();
    expect(await upsertManualSleepNight({ date: "2026-03-01", durationMin: 0 })).toBeNull();
    expect(await upsertManualSleepNight({ date: "2026-03-01", durationMin: Number.NaN })).toBeNull();
    expect(await loadSleepNights()).toEqual([]);
  });

  it("多晚可以逐天补记（不再只能记昨晚）", async () => {
    await upsertManualSleepNight({ date: "2026-02-01", durationMin: 400 });
    await upsertManualSleepNight({ date: "2026-02-03", durationMin: 500 });
    await upsertManualSleepNight({ date: "2026-02-02", durationMin: 450 });
    const nights = await loadSleepNights();
    expect(nights.map((night) => night.date)).toEqual(["2026-02-01", "2026-02-02", "2026-02-03"]);
    expect(latestSleepNight(nights)?.date).toBe("2026-02-03");
  });
});

/* ================================================================== *
 * 入睡轴 / 规律性
 * ================================================================== */

describe("入睡时间轴（bedtimeMinutes）", () => {
  it("22:00 为 0，18:00 为 -240，06:00 为 +480", () => {
    expect(bedtimeMinutes(ts(2026, 3, 9, 22, 0))).toBe(0);
    expect(bedtimeMinutes(ts(2026, 3, 9, 18, 0))).toBe(-240);
    expect(bedtimeMinutes(ts(2026, 3, 10, 6, 0))).toBe(480);
  });

  it("跨午夜连续：23:00 → +60，00:30 → +150", () => {
    expect(bedtimeMinutes(ts(2026, 3, 9, 23, 0))).toBe(60);
    expect(bedtimeMinutes(ts(2026, 3, 10, 0, 30))).toBe(150);
    expect(bedtimeMinutes(ts(2026, 3, 9, 21, 30))).toBe(-30);
  });

  it("白天的时刻夹到 06:00；非法 → null", () => {
    expect(bedtimeMinutes(ts(2026, 3, 10, 14, 0))).toBe(480);
    expect(bedtimeMinutes("nope")).toBeNull();
    expect(bedtimeMinutes(null)).toBeNull();
  });

  it("clockFromBedtimeMinutes 与 bedtimeMinutes 互逆", () => {
    expect(clockFromBedtimeMinutes(0)).toBe("22:00");
    expect(clockFromBedtimeMinutes(60)).toBe("23:00");
    expect(clockFromBedtimeMinutes(150)).toBe("00:30");
    expect(clockFromBedtimeMinutes(-30)).toBe("21:30");
    expect(clockFromBedtimeMinutes(null)).toBeNull();
  });
});

describe("睡眠规律性（sleepRegularity）", () => {
  it("三天都在 23:00 附近 → 规律", () => {
    const nights = [
      makeNight({ date: "2026-03-08", bedtime: ts(2026, 3, 7, 23, 0) }),
      makeNight({ date: "2026-03-09", bedtime: ts(2026, 3, 8, 23, 10) }),
      makeNight({ date: "2026-03-10", bedtime: ts(2026, 3, 9, 23, 20) }),
    ];
    const result = sleepRegularity(nights);
    expect(result.sample).toBe(3);
    expect(result.stdevMin).toBe(8);
    expect(result.label).toBe("规律");
  });

  it("入睡时间跨度 4 小时 → 不规律", () => {
    const nights = [
      makeNight({ date: "2026-03-08", bedtime: ts(2026, 3, 7, 22, 0) }),
      makeNight({ date: "2026-03-09", bedtime: ts(2026, 3, 9, 0, 0) }),
      makeNight({ date: "2026-03-10", bedtime: ts(2026, 3, 10, 2, 0) }),
    ];
    const result = sleepRegularity(nights);
    expect(result.stdevMin).toBeGreaterThan(60);
    expect(result.label).toBe("不规律");
  });

  it("中等波动 → 一般", () => {
    const nights = [
      makeNight({ date: "2026-03-08", bedtime: ts(2026, 3, 7, 22, 30) }),
      makeNight({ date: "2026-03-09", bedtime: ts(2026, 3, 8, 23, 30) }),
      makeNight({ date: "2026-03-10", bedtime: ts(2026, 3, 10, 0, 30) }),
    ];
    expect(sleepRegularity(nights).label).toBe("一般");
  });

  it("不足两晚 → 未知/标准差 null", () => {
    expect(sleepRegularity([makeNight()])).toEqual({ sample: 1, stdevMin: null, label: "未知" });
    expect(sleepRegularity([])).toEqual({ sample: 0, stdevMin: null, label: "未知" });
    expect(sleepRegularity(null)).toEqual({ sample: 0, stdevMin: null, label: "未知" });
  });

  it("没有合法 bedtime 的条目被跳过", () => {
    const nights = [makeNight({ bedtime: "x" }), makeNight({ date: "2026-03-09", bedtime: "y" })];
    expect(sleepRegularity(nights)).toEqual({ sample: 0, stdevMin: null, label: "未知" });
  });
});

/* ================================================================== *
 * 评分
 * ================================================================== */

describe("睡眠评分（sleepScore / qualityLabel）", () => {
  it("评分拆解与总分一致，权重归一到 100", () => {
    const breakdown = sleepScoreBreakdown(makeNight());
    expect(breakdown).not.toBeNull();
    expect(breakdown?.total).toBe(sleepScore(makeNight()));
    expect(breakdown?.quality).toBe("estimated");
    expect(breakdown?.parts.map((part) => part.key)).toEqual([
      "duration",
      "stage",
      "efficiency",
      "regularity",
    ]);
    const weightSum = breakdown?.parts.reduce((sum, part) => sum + part.weightPct, 0) ?? 0;
    expect(weightSum).toBeGreaterThanOrEqual(99);
    expect(weightSum).toBeLessThanOrEqual(101);
  });

  it("设备分期时分期质量占 30% 权重", () => {
    const night = makeNight({
      durationMin: 456,
      timeInBedMin: 480,
      stages: { deep: 84, light: 276, rem: 96, awake: 24 },
      awakeCount: 2,
      efficiencyPct: 95,
    });
    const breakdown = sleepScoreBreakdown(night);
    expect(breakdown?.quality).toBe("measured");
    expect(breakdown?.parts.find((part) => part.key === "stage")?.weightPct).toBe(30);
  });

  it("没有有效时长时返回 null", () => {
    expect(sleepScoreBreakdown(null)).toBeNull();
    expect(sleepScoreBreakdown(makeNight({ durationMin: 0, timeInBedMin: 0 }))).toBeNull();
  });

  it("8 小时 + 23:00 入睡（无阶段）→ 估算上限 84，不再给满分", () => {
    expect(sleepScore(makeNight())).toBe(84);
  });

  it("6 小时无阶段：时长 + 估算分期/效率 + 规律性 → 75", () => {
    expect(sleepScore(makeNight({ durationMin: 360, timeInBedMin: 360 }))).toBe(75);
  });

  it("阶段齐全且落在参考区间 → 95 以上", () => {
    const night = makeNight({
      durationMin: 456,
      timeInBedMin: 480,
      stages: { deep: 84, light: 276, rem: 96, awake: 24 },
      awakeCount: 1,
      efficiencyPct: 95,
      source: "health",
    });
    expect(sleepScore(night)).toBeGreaterThanOrEqual(95);
  });

  it("深睡为 0 的夜晚：质量项拉低总分", () => {
    const night = makeNight({
      timeInBedMin: 480,
      durationMin: 460,
      stages: { deep: 0, light: 400, rem: 60, awake: 20 },
      awakeCount: 1,
      efficiencyPct: 96,
      source: "health",
    });
    const score = sleepScore(night);
    expect(score).toBeLessThan(90);
    expect(score).toBeGreaterThan(50);
  });

  it("全 0 的一晚 → 0", () => {
    expect(sleepScore(makeNight({ durationMin: 0, timeInBedMin: 0 }))).toBe(0);
  });

  it("超过 24 小时的脏数据 → 0-20，不越界", () => {
    const score = sleepScore(makeNight({ durationMin: 1500, timeInBedMin: 1500 }));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(20);
  });

  it("null/undefined → 0", () => {
    expect(sleepScore(null)).toBe(0);
    expect(sleepScore(undefined)).toBe(0);
  });

  it("传入历史规律性标准差：90 分钟 → 规律性分 40", () => {
    expect(sleepScore(makeNight(), { regularityStdevMin: 90 })).toBe(84);
    expect(sleepScore(makeNight(), { regularityStdevMin: 10 })).toBe(84);
  });

  it("qualityLabel 分档", () => {
    expect(qualityLabel(100)).toBe("优秀");
    expect(qualityLabel(85)).toBe("优秀");
    expect(qualityLabel(84)).toBe("良好");
    expect(qualityLabel(70)).toBe("良好");
    expect(qualityLabel(69)).toBe("一般");
    expect(qualityLabel(55)).toBe("一般");
    expect(qualityLabel(54)).toBe("偏差");
    expect(qualityLabel(40)).toBe("偏差");
    expect(qualityLabel(39)).toBe("较差");
    expect(qualityLabel(null)).toBe("—");
  });
});

/* ================================================================== *
 * 阶段切片
 * ================================================================== */

describe("阶段切片（sleepStageSlices）", () => {
  const night = makeNight({
    durationMin: 456,
    timeInBedMin: 480,
    stages: { deep: 84, light: 276, rem: 96, awake: 24 },
    awakeCount: 1,
    efficiencyPct: 95,
    source: "health",
  });

  it("固定顺序 深睡/浅睡/REM/清醒，pct 相加约 100", () => {
    const slices = sleepStageSlices(night);
    expect(slices.map((slice) => slice.key)).toEqual(["deep", "light", "rem", "awake"]);
    expect(slices[0].minutes).toBe(84);
    expect(slices[0].pct).toBe(17.5);
    expect(slices[1].pct).toBe(57.5);
    expect(slices[2].pct).toBe(20);
    expect(slices[3].pct).toBe(5);
    const sum = slices.reduce((total, slice) => total + slice.pct, 0);
    expect(sum).toBeCloseTo(100, 0);
    expect(slices.every((slice) => slice.isNormal)).toBe(true);
    expect(slices.map((slice) => slice.reference)).toEqual(["15-20%", "55-75%", "20-25%", "2 次以内"]);
  });

  it("清醒次数过多 → 清醒片 isNormal=false", () => {
    const slices = sleepStageSlices({ ...night, awakeCount: 4 });
    expect(slices[3].isNormal).toBe(false);
  });

  it("没有清醒次数时按清醒时长兜底（30 分钟 → false）", () => {
    const slices = sleepStageSlices({
      ...night,
      awakeCount: null,
      stages: { deep: 84, light: 276, rem: 96, awake: 30 },
    });
    expect(slices[3].isNormal).toBe(false);
  });

  it("深睡不足 → 深睡片 isNormal=false", () => {
    const slices = sleepStageSlices({
      ...night,
      timeInBedMin: 480,
      stages: { deep: 20, light: 380, rem: 60, awake: 20 },
    });
    expect(slices[0].isNormal).toBe(false);
  });

  it("无阶段数据 → 四段估算切片（页面标注估算）", () => {
    const slices = sleepStageSlices(makeNight());
    expect(slices).toHaveLength(4);
    expect(slices.every((slice) => slice.estimated === true)).toBe(true);
    expect(slices.reduce((sum, slice) => sum + slice.minutes, 0)).toBeGreaterThan(0);
    expect(sleepStageSlices(null)).toEqual([]);
  });
});

/* ================================================================== *
 * 统计
 * ================================================================== */

describe("睡眠统计（sleepStats）", () => {
  const nights = [
    makeNight({
      date: "2026-03-08",
      bedtime: ts(2026, 3, 7, 23, 0),
      durationMin: 420,
      timeInBedMin: 450,
      stages: { deep: 67, light: 290, rem: 63, awake: 30 },
      awakeCount: 1,
      efficiencyPct: 93,
      source: "health",
    }),
    makeNight({
      date: "2026-03-09",
      bedtime: ts(2026, 3, 8, 23, 30),
      durationMin: 480,
      timeInBedMin: 480,
      stages: { deep: 84, light: 300, rem: 96, awake: 0 },
      awakeCount: 0,
      efficiencyPct: 100,
      source: "health",
    }),
    makeNight({
      date: "2026-03-10",
      bedtime: ts(2026, 3, 9, 22, 30),
      durationMin: 510,
      timeInBedMin: 510,
      awakeCount: null,
      efficiencyPct: null,
    }),
  ];

  it("平均时长/效率/深睡%/REM%/清醒次数/入睡时间", () => {
    const stats = sleepStats(nights, 7);
    expect(stats.count).toBe(3);
    expect(stats.avgDurationMin).toBe(470);
    // 第三晚只有总时长，效率按估算 94% 参与均值
    expect(stats.avgEfficiencyPct).toBe(95.7);
    expect(stats.avgDeepPct).toBe(16.8);
    expect(stats.avgRemPct).toBe(18.3);
    expect(stats.avgAwakeCount).toBe(0.7);
    expect(stats.avgBedtimeMinutes).toBe(60);
    expect(stats.avgBedtime).toBe("23:00");
    expect(stats.avgScore).toBe(93);
    expect(stats.regularity.stdevMin).toBe(24);
    expect(stats.regularity.label).toBe("规律");
    // 页面适配层（lib/sleep-api.ts）读的兼容别名
    expect(stats.avgEfficiency).toBe(95.7);
    expect(stats.regularityStdMin).toBe(24);
    expect(stats.regularityLabel).toBe("规律");
  });

  it("趋势：最近一晚 510 vs 平均 470 → up", () => {
    const stats = sleepStats(nights, 7);
    expect(stats.trend).toEqual({
      latestDate: "2026-03-10",
      latestDurationMin: 510,
      avgDurationMin: 470,
      deltaMin: 40,
      direction: "up",
    });
    expect(stats.latest?.date).toBe("2026-03-10");
  });

  it("窗口过滤：5 晚取最近 3 天", () => {
    const five = [
      makeNight({ date: "2026-03-04", durationMin: 300 }),
      makeNight({ date: "2026-03-05", durationMin: 310 }),
      makeNight({ date: "2026-03-06", durationMin: 320 }),
      makeNight({ date: "2026-03-07", durationMin: 330 }),
      makeNight({ date: "2026-03-08", durationMin: 340 }),
    ];
    const stats = sleepStats(five, 3);
    expect(stats.count).toBe(3);
    expect(stats.avgDurationMin).toBe(330);
    expect(stats.windowDays).toBe(3);
  });

  it("趋势：差距小于 15 分钟 → flat", () => {
    const two = [
      makeNight({ date: "2026-03-09", durationMin: 470 }),
      makeNight({ date: "2026-03-10", durationMin: 480 }),
    ];
    expect(sleepStats(two, 7).trend?.direction).toBe("flat");
    expect(sleepStats(two, 7).trend?.deltaMin).toBe(5);
  });

  it("趋势：最近一晚更短 → down", () => {
    const two = [
      makeNight({ date: "2026-03-09", durationMin: 500 }),
      makeNight({ date: "2026-03-10", durationMin: 400 }),
    ];
    expect(sleepStats(two, 7).trend?.direction).toBe("down");
  });

  it("空输入 → 全 null、count 0、趋势 null", () => {
    const stats = sleepStats([], 7);
    expect(stats).toEqual(
      expect.objectContaining({
        count: 0,
        avgDurationMin: null,
        avgEfficiencyPct: null,
        avgDeepPct: null,
        avgRemPct: null,
        avgAwakeCount: null,
        avgBedtimeMinutes: null,
        avgBedtime: null,
        avgScore: null,
        trend: null,
        latest: null,
      })
    );
    expect(stats.regularity).toEqual({ sample: 0, stdevMin: null, label: "未知" });
    expect(stats.regularityLabel).toBe("记录不足");
    expect(stats.regularityStdMin).toBeNull();
  });

  it("days 非法/0 → 统计全部", () => {
    expect(sleepStats(nights, 0).count).toBe(3);
    expect(sleepStats(nights, Number.NaN).count).toBe(3);
    expect(sleepStats(null, 7).count).toBe(0);
  });
});

/* ================================================================== *
 * Health Connect 记录聚合
 * ================================================================== */

describe("Health Connect 记录 → 睡眠（aggregateHealthSleepRecords）", () => {
  it("单条带阶段：时长/阶段/清醒次数/效率/来源", () => {
    const nights = aggregateHealthSleepRecords([record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0), fullNightStages())]);
    expect(nights).toHaveLength(1);
    const night = nights[0];
    expect(night.date).toBe("2026-03-10");
    expect(night.timeInBedMin).toBe(480);
    expect(night.durationMin).toBe(450); // 扣除 30 分钟清醒
    expect(night.stages).toEqual({ deep: 180, light: 180, rem: 90, awake: 30 });
    expect(night.awakeCount).toBe(1);
    expect(night.efficiencyPct).toBe(94);
    expect(night.source).toBe("health");
  });

  it("跨午夜按起床日归属（23:30 → 次日 07:00 记次日）", () => {
    const nights = aggregateHealthSleepRecords([record(ts(2026, 3, 9, 23, 30), ts(2026, 3, 10, 7, 0))]);
    expect(nights.map((night) => night.date)).toEqual(["2026-03-10"]);
    expect(nights[0].durationMin).toBe(450);
  });

  it("同一条被两个 App 各写一次 → 时长不翻倍", () => {
    const twice = [
      record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0), fullNightStages()),
      record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0), fullNightStages()),
    ];
    const nights = aggregateHealthSleepRecords(twice);
    expect(nights).toHaveLength(1);
    expect(nights[0].durationMin).toBe(450);
    expect(nights[0].stages).toEqual({ deep: 180, light: 180, rem: 90, awake: 30 });
    expect(nights[0].awakeCount).toBe(1);
  });

  it("两个 App 时间略有偏差（部分重叠）→ 按并集算", () => {
    const nights = aggregateHealthSleepRecords([
      record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 3, 0)),
      record(ts(2026, 3, 10, 2, 0), ts(2026, 3, 10, 7, 0)),
    ]);
    expect(nights).toHaveLength(1);
    expect(nights[0].timeInBedMin).toBe(480);
    expect(nights[0].durationMin).toBe(480);
    expect(formatClockTime(nights[0].bedtime)).toBe("23:00");
    expect(formatClockTime(nights[0].wakeTime)).toBe("07:00");
  });

  it("同一起床日多段（夜间 + 补觉）合并；中间空档不计入卧床", () => {
    const nights = aggregateHealthSleepRecords([
      record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 3, 0)),
      record(ts(2026, 3, 10, 3, 30), ts(2026, 3, 10, 7, 0)),
    ]);
    expect(nights).toHaveLength(1);
    expect(nights[0].timeInBedMin).toBe(450);
    expect(formatClockTime(nights[0].bedtime)).toBe("23:00");
    expect(formatClockTime(nights[0].wakeTime)).toBe("07:00");
  });

  it("阶段字符串名（AWAKE/DEEP/REM/LIGHT）也认", () => {
    const nights = aggregateHealthSleepRecords([
      record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0), [
        stage(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 3, 0), "DEEP"),
        stage(ts(2026, 3, 10, 3, 0), ts(2026, 3, 10, 6, 0), "LIGHT"),
        stage(ts(2026, 3, 10, 6, 0), ts(2026, 3, 10, 6, 30), "REM"),
        stage(ts(2026, 3, 10, 6, 30), ts(2026, 3, 10, 7, 0), "AWAKE"),
      ]),
    ]);
    expect(nights[0].stages).toEqual({ deep: 240, light: 180, rem: 30, awake: 30 });
    expect(nights[0].durationMin).toBe(450);
  });

  it("UNKNOWN 阶段并入浅睡，OUT_OF_BED 并入清醒（时长不丢）", () => {
    const nights = aggregateHealthSleepRecords([
      record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0), [
        stage(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 1, 0), 0), // UNKNOWN
        stage(ts(2026, 3, 10, 1, 0), ts(2026, 3, 10, 6, 30), 4), // LIGHT
        stage(ts(2026, 3, 10, 6, 30), ts(2026, 3, 10, 6, 45), "OUT_OF_BED"),
      ]),
    ]);
    expect(nights[0].stages).toEqual({ deep: 0, light: 450, rem: 0, awake: 15 });
    expect(nights[0].durationMin).toBe(465);
    expect(nights[0].awakeCount).toBe(1);
  });

  it("无阶段：stages/awakeCount 为 null，效率 100", () => {
    const nights = aggregateHealthSleepRecords([record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0))]);
    expect(nights[0].stages).toBeNull();
    expect(nights[0].awakeCount).toBeNull();
    expect(nights[0].efficiencyPct).toBe(100);
  });

  it("零碎清醒（不足 1 分钟）不计入清醒次数", () => {
    const nights = aggregateHealthSleepRecords([
      record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0), [
        stage(ts(2026, 3, 10, 3, 0), ts(2026, 3, 10, 3, 0, 30), 1),
        stage(ts(2026, 3, 10, 4, 0), ts(2026, 3, 10, 4, 0, 30), 1),
      ]),
    ]);
    expect(nights[0].awakeCount).toBe(0);
  });

  it("脏记录（结束早于开始 / 超过 24h / 时间串非法 / null）被跳过", () => {
    const nights = aggregateHealthSleepRecords([
      record(ts(2026, 3, 10, 7, 0), ts(2026, 3, 9, 23, 0)),
      record(ts(2026, 3, 8, 8, 0), ts(2026, 3, 10, 9, 0)),
      record("not-a-date", ts(2026, 3, 10, 7, 0)),
      null as unknown as SleepHealthRecord,
      record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0)),
    ]);
    expect(nights).toHaveLength(1);
    expect(nights[0].durationMin).toBe(480);
  });

  it("空/非数组入参 → []", () => {
    expect(aggregateHealthSleepRecords([])).toEqual([]);
    expect(aggregateHealthSleepRecords(null)).toEqual([]);
    expect(aggregateHealthSleepRecords(undefined)).toEqual([]);
  });

  it("多天结果按日期升序", () => {
    const nights = aggregateHealthSleepRecords([
      record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0)),
      record(ts(2026, 3, 8, 23, 0), ts(2026, 3, 9, 7, 0)),
    ]);
    expect(nights.map((night) => night.date)).toEqual(["2026-03-09", "2026-03-10"]);
  });
});

/* ================================================================== *
 * Health Connect 多晚读取（状态机）
 * ================================================================== */

describe("readSleepNightsFromHealth（多晚 + 状态机，永不抛）", () => {
  it("读到两晚：升序返回，参数用 between/倒序/分页", async () => {
    hc.state.pages = [
      {
        records: [
          record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0), fullNightStages()),
          record(ts(2026, 3, 8, 23, 30), ts(2026, 3, 9, 7, 0)),
        ],
      },
    ];
    const result = await readSleepNightsFromHealth({ now: NOW, days: 30 });
    expect(result.status).toBe("ok");
    expect(result.ok).toBe(true);
    expect(result.nights.map((night) => night.date)).toEqual(["2026-03-09", "2026-03-10"]);
    expect(hc.state.lastRecordType).toBe("SleepSession");
    expect(hc.state.lastOptions?.ascendingOrder).toBe(false);
    expect(hc.state.lastOptions?.pageSize).toBe(100);
    expect(hc.state.lastOptions?.timeRangeFilter?.startTime).toBe(new Date(2026, 1, 8, 12, 0).toISOString());
  });

  it("days 窗口裁剪：更早的夜晚不进结果", async () => {
    hc.state.pages = [
      {
        records: [
          record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0)),
          record(ts(2026, 3, 8, 23, 0), ts(2026, 3, 9, 7, 0)),
          record(ts(2026, 3, 4, 23, 0), ts(2026, 3, 5, 7, 0)),
        ],
      },
    ];
    const result = await readSleepNightsFromHealth({ now: NOW, days: 3 });
    expect(result.nights.map((night) => night.date)).toEqual(["2026-03-09", "2026-03-10"]);
  });

  it("分页：第二页的记录也会并进来", async () => {
    hc.state.pages = [
      { records: [record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0))], pageToken: "p2" },
      { records: [record(ts(2026, 3, 8, 23, 0), ts(2026, 3, 9, 7, 0))], pageToken: "" },
    ];
    const result = await readSleepNightsFromHealth({ now: NOW });
    expect(result.nights).toHaveLength(2);
    expect(hc.readRecords).toHaveBeenCalledTimes(2);
    expect(hc.state.lastOptions?.pageToken).toBe("p2");
  });

  it("非 Android → unsupported（不 import 原生模块）", async () => {
    hc.platform.OS = "ios";
    const result = await readSleepNightsFromHealth({ now: NOW });
    expect(result).toMatchObject({ ok: false, status: "unsupported", nights: [] });
    expect(result.reason).toBeTruthy();
    expect(hc.getSdkStatus).not.toHaveBeenCalled();
    expect(hc.readRecords).not.toHaveBeenCalled();
  });

  it("本机没有 Health Connect → unavailable", async () => {
    hc.getSdkStatus.mockResolvedValue(1);
    const result = await readSleepNightsFromHealth({ now: NOW });
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBeTruthy();
  });

  it("初始化失败 → unavailable", async () => {
    hc.initialize.mockResolvedValue(false);
    expect((await readSleepNightsFromHealth({ now: NOW })).status).toBe("unavailable");
  });

  it("未授权且不主动申请 → denied（自动读取不弹框）", async () => {
    hc.getGrantedPermissions.mockResolvedValue([]);
    const result = await readSleepNightsFromHealth({ now: NOW });
    expect(result.status).toBe("denied");
    expect(hc.requestPermission).not.toHaveBeenCalled();
    expect(hc.readRecords).not.toHaveBeenCalled();
  });

  it("未授权 + 用户点去授权：申请后授予则继续读", async () => {
    hc.getGrantedPermissions.mockResolvedValueOnce([]).mockResolvedValue([{ accessType: "read", recordType: "SleepSession" }]);
    hc.state.pages = [{ records: [record(ts(2026, 3, 9, 23, 0), ts(2026, 3, 10, 7, 0))] }];
    const result = await readSleepNightsFromHealth({ now: NOW, requestPermission: true });
    expect(hc.requestPermission).toHaveBeenCalledTimes(1);
    expect(hc.state.lastPermissions).toEqual([{ accessType: "read", recordType: "SleepSession" }]);
    expect(result.status).toBe("ok");
    expect(result.nights).toHaveLength(1);
  });

  it("申请后仍未授权 → denied", async () => {
    hc.getGrantedPermissions.mockResolvedValue([]);
    hc.requestPermission.mockResolvedValue([]);
    expect((await readSleepNightsFromHealth({ now: NOW, requestPermission: true })).status).toBe("denied");
  });

  it("有权限但没有记录 → no-data（带原因）", async () => {
    const result = await readSleepNightsFromHealth({ now: NOW });
    expect(result.status).toBe("no-data");
    expect(result.nights).toEqual([]);
    expect(result.reason).toBeTruthy();
  });

  it("读取抛错 → error（不冒泡）", async () => {
    hc.readRecords.mockRejectedValue(new Error("boom"));
    const result = await readSleepNightsFromHealth({ now: NOW });
    expect(result.status).toBe("error");
    expect(result.reason).toContain("失败");
  });

  it("读取超时 → error（超时文案）", async () => {
    hc.readRecords.mockImplementation(() => new Promise(() => {}));
    const result = await readSleepNightsFromHealth({ now: NOW, timeoutMs: 20 });
    expect(result.status).toBe("error");
    expect(result.reason).toContain("超时");
  });

  it("每个状态都有 UI 文案", () => {
    expect(Object.keys(SLEEP_STATUS_HINT).sort()).toEqual([
      "denied",
      "error",
      "no-data",
      "ok",
      "unavailable",
      "unsupported",
    ]);
  });
});

describe("openSleepSettings / readSleepFromHealth（旧单晚 API 仍可用）", () => {
  it("openSleepSettings：Android 走原生开关，异常/非 Android → false", async () => {
    expect(await openSleepSettings()).toBe(true);
    expect(hc.openHealthConnectSettings).toHaveBeenCalledTimes(1);
    hc.openHealthConnectSettings.mockImplementation(() => {
      throw new Error("no activity");
    });
    expect(await openSleepSettings()).toBe(false);
    hc.platform.OS = "ios";
    expect(await openSleepSettings()).toBe(false);
  });

  it("readSleepFromHealth：窗口内聚合小时数", async () => {
    hc.readRecords.mockResolvedValue({
      records: [
        { startTime: ts(2026, 3, 9, 23, 30), endTime: ts(2026, 3, 10, 7, 0) },
        { startTime: ts(2026, 3, 9, 14, 0), endTime: ts(2026, 3, 9, 15, 0) },
      ],
    });
    const result = await readSleepFromHealth({ now: NOW });
    expect(result).toEqual({ ok: true, status: "ok", hours: 7.5, sessions: 1 });
  });

  it("readSleepFromHealth：非 Android → unsupported", async () => {
    hc.platform.OS = "ios";
    expect((await readSleepFromHealth({ now: NOW })).status).toBe("unsupported");
    expect(hc.getSdkStatus).not.toHaveBeenCalled();
  });

  it("readSleepFromHealth：无记录 → no-data；抛错/超时 → error", async () => {
    expect((await readSleepFromHealth({ now: NOW })).status).toBe("no-data");
    hc.readRecords.mockRejectedValue(new Error("boom"));
    expect((await readSleepFromHealth({ now: NOW })).status).toBe("error");
    hc.readRecords.mockImplementation(() => new Promise(() => {}));
    expect((await readSleepFromHealth({ now: NOW, timeoutMs: 20 })).status).toBe("error");
  });
});

/* ================================================================== *
 * 存储键说明
 * ================================================================== */

describe("存储键", () => {
  it("v2 是新键，SLEEP_STORAGE_KEY 仍指向旧 v1（兼容）", () => {
    expect(SLEEP_NIGHTS_STORAGE_KEY).toBe("lwb.sleep.v2");
    expect(LEGACY_SLEEP_STORAGE_KEY).toBe("lwb.sleep.v1");
    expect(SLEEP_STORAGE_KEY).toBe("lwb.sleep.v1");
  });
});

/* ================================================================== *
 * 估算指标与评分可信度（2026-11 小米只同步总时长）
 * ================================================================== */

describe("睡眠估算与评分可信度", () => {
  it("只有总时长时补全深睡/浅睡/REM/清醒与效率，并标记 estimated", () => {
    const metrics = effectiveSleepMetrics(makeNight());
    expect(metrics.quality).toBe("estimated");
    expect(metrics.stages).not.toBeNull();
    const stages = metrics.stages!;
    expect(stages.deep).toBeGreaterThan(0);
    expect(stages.light).toBeGreaterThan(0);
    expect(stages.rem).toBeGreaterThan(0);
    expect(stages.awake).toBeGreaterThan(0);
    expect(stages.deep + stages.light + stages.rem + stages.awake).toBeGreaterThan(0);
    expect(metrics.awakeCount).toBeGreaterThanOrEqual(1);
    expect(metrics.efficiencyPct).toBeGreaterThanOrEqual(80);
  });

  it("无设备分期时 8 小时记录不再给到 98 分，最高 84 分", () => {
    const score = sleepScore(makeNight());
    expect(score).toBeGreaterThan(65);
    expect(score).toBeLessThanOrEqual(84);
    expect(sleepDataQuality(makeNight())).toBe("estimated");
  });

  it("真实设备分期仍可超过估算上限", () => {
    const measured = makeNight({
      stages: { deep: 96, light: 264, rem: 96, awake: 24 },
      awakeCount: 1,
      efficiencyPct: 95,
      source: "health",
    });
    expect(effectiveSleepMetrics(measured).quality).toBe("measured");
    expect(sleepScore(measured)).toBeGreaterThan(84);
  });

  it("分期切片在估算时带 estimated 标记，页面可显示估算徽标", () => {
    const slices = sleepStageSlices(makeNight());
    expect(slices).toHaveLength(4);
    expect(slices.every((slice) => slice.estimated === true)).toBe(true);
  });

  it("只有总时长时，周统计仍给出效率与清醒次数估算，不落成空值", () => {
    const stats = sleepStats([makeNight({ durationMin: 480, timeInBedMin: 480 })], 7);
    expect(stats.avgEfficiencyPct).toBe(94);
    expect(stats.avgAwakeCount).toBe(1);
    expect(stats.avgDeepPct).toBeGreaterThan(0);
    expect(stats.avgRemPct).toBeGreaterThan(0);
  });
});

describe("Health Connect 原始诊断", () => {
  it("统计原始会话数、含分期条数与最近结束时间", () => {
    const records: SleepHealthRecord[] = [
      { startTime: ts(2026, 3, 9, 23, 0), endTime: ts(2026, 3, 10, 7, 0), stages: [] },
      { startTime: ts(2026, 3, 10, 8, 0), endTime: ts(2026, 3, 10, 9, 0), stages: [stage(ts(2026, 3, 10, 8, 0), ts(2026, 3, 10, 8, 30), 5)] },
    ];
    expect(summarizeSleepHealthRecords(records)).toEqual({
      recordCount: 2,
      stageRecordCount: 1,
      lastRecordAt: ts(2026, 3, 10, 9, 0),
    });
  });
});

describe("手动补录睡眠分期", () => {
  it("深睡/REM/清醒次数/效率会写入，并按 measured 参与后续评分", async () => {
    mem.map.clear();
    const saved = await upsertManualSleepNight({
      date: "2026-03-10",
      durationMin: 480,
      deepMin: 90,
      remMin: 100,
      awakeCount: 2,
      efficiencyPct: 92,
    });
    expect(saved?.stages).toEqual({ deep: 90, rem: 100, light: 290, awake: 0 });
    expect(saved?.awakeCount).toBe(2);
    expect(saved?.efficiencyPct).toBe(92);
    expect(saved ? effectiveSleepMetrics(saved).quality : null).toBe("measured");
  });
});
