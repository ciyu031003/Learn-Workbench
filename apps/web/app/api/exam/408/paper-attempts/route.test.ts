import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { pgPool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { currentUserId } from "@/lib/session";
import { GET, POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userMock = vi.mocked(currentUserId);
const logErrorMock = vi.mocked(logger.error);

/** 数据库 RETURNING / SELECT 行（pg 对 bigint 返回 string、timestamptz 返回 Date） */
const rowFixture = {
  id: "42",
  paper_year: 2016,
  score: 88,
  total_score: 150,
  correct: 40,
  wrong: 5,
  unanswered: 2,
  duration_seconds: 7200,
  started_at: "2026-11-03T02:00:00.000Z",
  submitted_at: new Date("2026-11-03T04:05:00.000Z"),
  by_point: [{ key: "ds-01", title: "线性表", wrong: 2, total: 10 }],
  by_subject: [{ key: "data-structure", title: "数据结构", wrong: 3, total: 20 }],
};

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    year: 2016,
    score: 88,
    totalScore: 150,
    correct: 40,
    wrong: 5,
    unanswered: 2,
    durationSeconds: 7200,
    startedAt: "2026-11-03T10:00:00+08:00",
    submittedAt: "2026-11-03T12:05:00+08:00",
    byPoint: [{ key: "ds-01", title: "线性表", wrong: 2, total: 10 }],
    bySubject: [{ key: "data-structure", title: "数据结构", wrong: 3, total: 20 }],
    ...overrides,
  };
}

function getRequest(url: string): Request {
  return new Request(url);
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/exam/408/paper-attempts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** GET 会并行发两条查询：count(*) 与列表；按 SQL 内容分流 */
function mockListQueries(total: number | string = 1, rows: unknown[] = [rowFixture]) {
  queryMock.mockImplementation(((sql: string) => {
    if (/count\(\*\)/i.test(sql)) return Promise.resolve({ rows: [{ total }] });
    return Promise.resolve({ rows });
  }) as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  userMock.mockResolvedValue("u-1");
});

describe("GET /api/exam/408/paper-attempts", () => {
  it("未登录返回 401，不查库", async () => {
    userMock.mockResolvedValueOnce(null);
    const response = await GET(getRequest("http://localhost/api/exam/408/paper-attempts"));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "请先登录", code: "unauthorized" });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("默认 limit 20：按 user_id 查总数与列表，id 一律 string", async () => {
    mockListQueries("3");
    const response = await GET(getRequest("http://localhost/api/exam/408/paper-attempts"));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.total).toBe(3);
    expect(payload.attempts).toHaveLength(1);
    expect(payload.attempts[0]).toMatchObject({
      id: "42",
      year: 2016,
      score: 88,
      totalScore: 150,
      durationSeconds: 7200,
      submittedAt: "2026-11-03T04:05:00.000Z",
    });

    const calls = queryMock.mock.calls.map(([sql, args]) => [String(sql), args] as const);
    const countCall = calls.find(([sql]) => /count\(\*\)/i.test(sql));
    const listCall = calls.find(([sql]) => /ORDER BY submitted_at DESC/.test(sql));
    expect(countCall?.[1]).toEqual(["u-1"]);
    expect(listCall?.[1]).toEqual(["u-1", 20]);
  });

  it("limit 透传并 clamp：&limit=999 → 50，&limit=0 → 1，&limit=abc → 20", async () => {
    mockListQueries(0, []);
    await GET(getRequest("http://localhost/api/exam/408/paper-attempts?limit=999"));
    await GET(getRequest("http://localhost/api/exam/408/paper-attempts?limit=0"));
    await GET(getRequest("http://localhost/api/exam/408/paper-attempts?limit=abc"));

    const limits = queryMock.mock.calls
      .filter(([sql]) => /LIMIT \$2/.test(String(sql)))
      .map(([, args]) => (args as unknown[])[1]);
    expect(limits).toEqual([50, 1, 20]);
  });

  it("查询异常返回 500 结构化错误并记日志", async () => {
    queryMock.mockRejectedValue(new Error("pg down"));
    const response = await GET(getRequest("http://localhost/api/exam/408/paper-attempts"));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "套卷成绩加载失败", code: "internal_error" });
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/exam/408/paper-attempts", () => {
  it("未登录返回 401，不写库", async () => {
    userMock.mockResolvedValueOnce(null);
    const response = await POST(postRequest(validBody()));
    expect(response.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("结构非法：缺字段 / 年份越界 / 非 JSON body 一律 400 且不写库", async () => {
    expect((await POST(postRequest({}))).status).toBe(400);
    expect((await POST(postRequest(validBody({ year: 1999 })))).status).toBe(400);
    expect((await POST(postRequest(validBody({ byPoint: "[]" })))).status).toBe(400);

    const notJson = new Request("http://localhost/api/exam/408/paper-attempts", {
      method: "POST",
      body: "not-json",
    });
    expect((await POST(notJson)).status).toBe(400);

    expect(queryMock).not.toHaveBeenCalled();
  });

  it("合法提交：201 + attempt；INSERT 带 user_id 与归一化参数", async () => {
    queryMock.mockResolvedValueOnce({ rows: [rowFixture] } as never);

    const response = await POST(postRequest(validBody()));
    expect(response.status).toBe(201);

    const payload = await response.json();
    expect(payload.attempt).toMatchObject({
      id: "42",
      year: 2016,
      score: 88,
      totalScore: 150,
      correct: 40,
      wrong: 5,
      unanswered: 2,
      startedAt: "2026-11-03T02:00:00.000Z",
      submittedAt: "2026-11-03T04:05:00.000Z",
    });

    const [sql, args] = queryMock.mock.calls[0];
    const text = String(sql);
    expect(text).toContain("INSERT INTO exam_408_paper_attempts");
    expect(text).toContain("$11::jsonb");
    expect(text).toContain("$12::jsonb");
    expect((args as unknown[])[0]).toBe("u-1");
    expect((args as unknown[])[8]).toBe("2026-11-03T02:00:00.000Z");
    expect((args as unknown[])[9]).toBe("2026-11-03T04:05:00.000Z");
    expect((args as unknown[])[10]).toBe(JSON.stringify([{ key: "ds-01", title: "线性表", wrong: 2, total: 10 }]));
  });

  it("写库异常返回 500 结构化错误并记日志", async () => {
    queryMock.mockRejectedValueOnce(new Error("pg down"));
    const response = await POST(postRequest(validBody()));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "套卷成绩保存失败", code: "internal_error" });
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});
