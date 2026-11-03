import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAPER_HISTORY_KEY,
  fetchPaperAttempts,
  formatPaperAttemptTime,
  formatPaperDuration,
  loadPaperHistory,
  normalizePaperAttempt,
  paperAccuracy,
  sortPaperAttempts,
  submitPaperAttempt,
  type PaperAttemptPayload,
} from "./paper-history";

/**
 * 408 套卷历史成绩客户端（P3-2B）单测。
 *
 * 契约（web-paper 实现中）：
 *   POST /api/exam/408/paper-attempts（Bearer）→ 201 { attempt }
 *   GET  /api/exam/408/paper-attempts?limit=20 → { attempts, total }
 * 这里钉住：未登录/401/离线/5xx 都不抛且落本地缓存、成功用服务端 id 覆盖本地记录、
 * GET 成功刷新缓存、本地缓存倒序截断 20 条与脏数据清洗。
 */

const state = vi.hoisted(() => ({ token: "tok" as string | null }));
const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@/config", () => ({ getApiUrl: () => "https://api.test/" }));
vi.mock("@/store/app-store", () => ({ useAppStore: { getState: () => state } }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

const fetchMock = vi.fn();

function payload(overrides: Partial<PaperAttemptPayload> = {}): PaperAttemptPayload {
  return {
    year: 2024,
    score: 68,
    totalScore: 150,
    correct: 34,
    wrong: 6,
    unanswered: 2,
    durationSeconds: 5400,
    startedAt: "2026-11-03T10:00:00.000Z",
    submittedAt: "2026-11-03T11:30:00.000Z",
    byPoint: [{ key: "kp-1", title: "线性表", wrong: 2, total: 4 }],
    bySubject: [{ key: "ds", title: "数据结构", wrong: 4, total: 20 }],
    ...overrides,
  };
}

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  state.token = "tok";
  storage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("submitPaperAttempt", () => {
  it("未登录不发请求，仅写本地缓存并返回 unauthorized", async () => {
    state.token = null;
    const outcome = await submitPaperAttempt(payload());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome.ok).toBe(false);
    expect(outcome.failure).toBe("unauthorized");
    expect(outcome.record?.id.startsWith("local-")).toBe(true);

    const cached = await loadPaperHistory();
    expect(cached).toHaveLength(1);
    expect(cached[0]).toMatchObject({ year: 2024, score: 68, wrong: 6, unanswered: 2 });
    expect(storage.has(PAPER_HISTORY_KEY)).toBe(true);
  });

  it("登录后按契约 POST（Bearer + camelCase 字段），成功用服务端 id 落缓存", async () => {
    fetchMock.mockResolvedValueOnce(
      response(201, {
        attempt: { ...payload(), id: "att-1", createdAt: "2026-11-03T11:30:02.000Z" },
      }),
    );

    const outcome = await submitPaperAttempt(payload());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("https://api.test/api/exam/408/paper-attempts");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual(payload());

    expect(outcome).toMatchObject({ ok: true, failure: null });
    expect(outcome.record?.id).toBe("att-1");
    const cached = await loadPaperHistory();
    expect(cached.map((item) => item.id)).toContain("att-1");
  });

  it("服务端只回 id 时，用本次载荷补全历史记录", async () => {
    fetchMock.mockResolvedValueOnce(response(201, { attempt: { id: "att-min" } }));

    const outcome = await submitPaperAttempt(payload({ year: 2023, score: 90 }));

    expect(outcome.ok).toBe(true);
    expect(outcome.record).toMatchObject({
      id: "att-min",
      year: 2023,
      score: 90,
      totalScore: 150,
      durationSeconds: 5400,
    });
  });

  it("401 降级为仅本地保存，不抛异常", async () => {
    fetchMock.mockResolvedValueOnce(response(401, { error: "未登录" }));

    const outcome = await submitPaperAttempt(payload());

    expect(outcome.ok).toBe(false);
    expect(outcome.failure).toBe("unauthorized");
    expect(outcome.record?.id.startsWith("local-")).toBe(true);
    expect(await loadPaperHistory()).toHaveLength(1);
  });

  it("网络异常按 offline 处理并写本地缓存", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network request failed"));

    const outcome = await submitPaperAttempt(payload());

    expect(outcome.ok).toBe(false);
    expect(outcome.failure).toBe("offline");
    expect(await loadPaperHistory()).toHaveLength(1);
  });

  it("5xx 按 server 处理并写本地缓存", async () => {
    fetchMock.mockResolvedValueOnce(response(500, { error: "boom" }));

    const outcome = await submitPaperAttempt(payload());

    expect(outcome.ok).toBe(false);
    expect(outcome.failure).toBe("server");
    expect(await loadPaperHistory()).toHaveLength(1);
  });

  it("201 但响应体结构异常时不冒充失败：本地记录兜底并返回 ok", async () => {
    fetchMock.mockResolvedValueOnce(response(201, null));

    const outcome = await submitPaperAttempt(payload());

    expect(outcome.ok).toBe(true);
    expect(outcome.failure).toBe(null);
    expect(outcome.record?.id.startsWith("local-")).toBe(true);
  });
});

describe("fetchPaperAttempts", () => {
  it("未登录不发请求，返回 unauthorized", async () => {
    state.token = null;
    const result = await fetchPaperAttempts();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ attempts: [], total: 0, failure: "unauthorized" });
  });

  it("登录后带 Bearer 与 limit，成功返回列表并刷新本地缓存", async () => {
    fetchMock.mockResolvedValueOnce(
      response(200, {
        attempts: [
          { ...payload(), id: "att-2", submittedAt: "2026-11-02T09:00:00.000Z" },
          { ...payload(), id: "att-1", submittedAt: "2026-11-01T09:00:00.000Z" },
        ],
        total: 3,
      }),
    );

    const result = await fetchPaperAttempts(20);

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://api.test/api/exam/408/paper-attempts?limit=20");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(result.failure).toBe(null);
    expect(result.total).toBe(3);
    expect(result.attempts.map((item) => item.id)).toEqual(["att-2", "att-1"]);

    const cached = await loadPaperHistory();
    expect(cached.map((item) => item.id)).toEqual(["att-2", "att-1"]);
  });

  it("limit 越界时收敛到 1-20", async () => {
    fetchMock.mockResolvedValue(response(200, { attempts: [], total: 0 }));
    await fetchPaperAttempts(999);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("limit=20");
    fetchMock.mockClear();
    await fetchPaperAttempts(0);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("limit=20");
  });

  it("401 / 500 / 网络异常 / 结构异常都返回结构化 failure", async () => {
    fetchMock.mockResolvedValueOnce(response(401, {}));
    expect(await fetchPaperAttempts()).toMatchObject({ attempts: [], total: 0, failure: "unauthorized" });

    fetchMock.mockResolvedValueOnce(response(500, {}));
    expect(await fetchPaperAttempts()).toMatchObject({ attempts: [], total: 0, failure: "server" });

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchPaperAttempts()).toMatchObject({ attempts: [], total: 0, failure: "offline" });

    fetchMock.mockResolvedValueOnce(response(200, { attempts: "nope" }));
    expect(await fetchPaperAttempts()).toMatchObject({ attempts: [], total: 0, failure: "server" });
  });
});

describe("本机缓存", () => {
  it("最多保留 20 条并按 submittedAt 降序", async () => {
    const records = Array.from({ length: 25 }, (_, index) => ({
      ...payload(),
      id: `id-${index}`,
      submittedAt: new Date(Date.UTC(2026, 10, 3, 0, index)).toISOString(),
    }));
    storage.set(PAPER_HISTORY_KEY, JSON.stringify(records));

    const cached = await loadPaperHistory();
    expect(cached).toHaveLength(20);
    expect(cached[0].id).toBe("id-24");
    expect(cached[19].id).toBe("id-5");
    for (let index = 1; index < cached.length; index += 1) {
      expect(Date.parse(cached[index - 1].submittedAt)).toBeGreaterThanOrEqual(Date.parse(cached[index].submittedAt));
    }
  });

  it("脏数据清洗：丢弃非法记录、接受数字字符串、清洗统计行", async () => {
    const valid = {
      id: "ok",
      year: "2024",
      score: "68",
      totalScore: 150,
      correct: 34,
      wrong: 6,
      unanswered: 2,
      durationSeconds: 5400,
      startedAt: "2026-11-03T10:00:00.000Z",
      submittedAt: "2026-11-03T11:30:00.000Z",
      byPoint: [null, { key: "  " }, { key: " kp-1 ", title: "", wrong: "2", total: 3 }],
      bySubject: "nope",
    };
    storage.set(
      PAPER_HISTORY_KEY,
      JSON.stringify([
        valid,
        {},
        { id: "old-year", year: 1999, submittedAt: "2026-11-03T11:30:00.000Z" },
        { id: "bad-time", year: 2024, submittedAt: "not-a-date" },
        { id: "no-time", year: 2024 },
      ]),
    );

    const cached = await loadPaperHistory();
    expect(cached).toHaveLength(1);
    expect(cached[0]).toMatchObject({
      id: "ok",
      year: 2024,
      score: 68,
      totalScore: 150,
      correct: 34,
      wrong: 6,
      unanswered: 2,
      submittedAt: "2026-11-03T11:30:00.000Z",
    });
    expect(cached[0].byPoint).toEqual([{ key: "kp-1", title: "kp-1", wrong: 2, total: 3 }]);
    expect(cached[0].bySubject).toEqual([]);
  });

  it("缓存 JSON 损坏或不是数组时返回空数组", async () => {
    storage.set(PAPER_HISTORY_KEY, "{not-json");
    expect(await loadPaperHistory()).toEqual([]);
    storage.set(PAPER_HISTORY_KEY, JSON.stringify({ attempts: [] }));
    expect(await loadPaperHistory()).toEqual([]);
  });

  it("sortPaperAttempts：同 id 后写覆盖、同时间按 id 升序", () => {
    const sorted = sortPaperAttempts([
      { ...payload(), id: "b", submittedAt: "2026-11-03T11:30:00.000Z", score: 1 },
      { ...payload(), id: "a", submittedAt: "2026-11-03T11:30:00.000Z", score: 2 },
      { ...payload(), id: "b", submittedAt: "2026-11-03T11:30:00.000Z", score: 3 },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["a", "b"]);
    expect(sorted.find((item) => item.id === "b")?.score).toBe(3);
  });
});

describe("normalizePaperAttempt", () => {
  it("缺失必要字段（年份 / 交卷时间）返回 null", () => {
    expect(normalizePaperAttempt(null)).toBe(null);
    expect(normalizePaperAttempt([])).toBe(null);
    expect(normalizePaperAttempt({ year: 2024 })).toBe(null);
    expect(normalizePaperAttempt({ submittedAt: "2026-11-03T11:30:00.000Z" })).toBe(null);
  });

  it("createdAt 可兜底 submittedAt，数字 id 转字符串", () => {
    const record = normalizePaperAttempt({
      id: 123,
      year: 2024,
      createdAt: "2026-11-03T11:30:00.000Z",
    });
    expect(record).toMatchObject({ id: "123", year: 2024, submittedAt: "2026-11-03T11:30:00.000Z" });
    expect(record?.startedAt).toBe("2026-11-03T11:30:00.000Z");
  });
});

describe("展示格式化", () => {
  it("formatPaperDuration", () => {
    expect(formatPaperDuration(0)).toBe("0 秒");
    expect(formatPaperDuration(59)).toBe("59 秒");
    expect(formatPaperDuration(60)).toBe("1 分 0 秒");
    expect(formatPaperDuration(754)).toBe("12 分 34 秒");
    expect(formatPaperDuration(7200)).toBe("2 小时 0 分");
    expect(formatPaperDuration(-8)).toBe("0 秒");
    expect(formatPaperDuration(Number.NaN)).toBe("0 秒");
  });

  it("paperAccuracy 只按已判对错计算", () => {
    expect(paperAccuracy(34, 6)).toBe(85);
    expect(paperAccuracy(0, 0)).toBe(0);
    expect(paperAccuracy(0, 3)).toBe(0);
    expect(paperAccuracy(1, 2)).toBe(33);
  });

  it("formatPaperAttemptTime 无法解析时返回空串", () => {
    expect(formatPaperAttemptTime("not-a-date")).toBe("");
    const formatted = formatPaperAttemptTime("2026-11-03T11:30:00.000Z");
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});
