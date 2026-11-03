import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));

import { pgPool } from "@/lib/db";
import {
  PAPER_ATTEMPT_DEFAULT_LIMIT,
  PAPER_ATTEMPT_MAX_LIMIT,
  PAPER_ATTEMPT_MIN_LIMIT,
  clampPaperAttemptLimit,
  createPaperAttempt,
  listPaperAttempts,
  mapPaperAttemptRow,
  normalizePaperAttemptBreakdown,
  normalizePaperAttemptInput,
  type PaperAttemptInput,
} from "./exam-408-paper-attempts";

const queryMock = vi.mocked(pgPool.query);

beforeEach(() => {
  vi.resetAllMocks();
});

/** 一份结构完全合法的 body（各用例按需覆盖字段） */
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

function normalized(): PaperAttemptInput {
  const parsed = normalizePaperAttemptInput(validBody());
  if (!parsed.ok) throw new Error("fixture 应当合法：" + parsed.error);
  return parsed.value;
}

/** 数据库 RETURNING 行的形态（pg 对 bigint 返回 string、timestamptz 返回 Date） */
const rowFixture = {
  id: "7",
  paper_year: 2016,
  score: "88",
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

describe("normalizePaperAttemptInput（入参校验 / 归一化）", () => {
  it("合法 body：时间统一为 UTC ISO，计数字段原样保留", () => {
    const result = normalizePaperAttemptInput(validBody());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      year: 2016,
      score: 88,
      totalScore: 150,
      correct: 40,
      wrong: 5,
      unanswered: 2,
      durationSeconds: 7200,
      startedAt: "2026-11-03T02:00:00.000Z",
      submittedAt: "2026-11-03T04:05:00.000Z",
      byPoint: [{ key: "ds-01", title: "线性表", wrong: 2, total: 10 }],
      bySubject: [{ key: "data-structure", title: "数据结构", wrong: 3, total: 20 }],
    });
  });

  it("year 边界：2000 / 2100 合法，1999 / 2101 / 小数 / 字符串 非法", () => {
    expect(normalizePaperAttemptInput(validBody({ year: 2000 })).ok).toBe(true);
    expect(normalizePaperAttemptInput(validBody({ year: 2100 })).ok).toBe(true);
    expect(normalizePaperAttemptInput(validBody({ year: 1999 })).ok).toBe(false);
    expect(normalizePaperAttemptInput(validBody({ year: 2101 })).ok).toBe(false);
    expect(normalizePaperAttemptInput(validBody({ year: 2016.5 })).ok).toBe(false);
    expect(normalizePaperAttemptInput(validBody({ year: "2016" })).ok).toBe(false);
  });

  it("计数字段：负数 / 小数 / 字符串 / 缺失 一律 400", () => {
    for (const field of ["score", "totalScore", "correct", "wrong", "unanswered"]) {
      expect(normalizePaperAttemptInput(validBody({ [field]: -1 })).ok).toBe(false);
      expect(normalizePaperAttemptInput(validBody({ [field]: 1.5 })).ok).toBe(false);
      expect(normalizePaperAttemptInput(validBody({ [field]: "3" })).ok).toBe(false);
      expect(normalizePaperAttemptInput(validBody({ [field]: undefined })).ok).toBe(false);
    }
  });

  it("durationSeconds：null / 缺失 视为 null；负数与小数 400", () => {
    const withNull = normalizePaperAttemptInput(validBody({ durationSeconds: null }));
    expect(withNull.ok && withNull.value.durationSeconds).toBeNull();

    const missing = normalizePaperAttemptInput(validBody({ durationSeconds: undefined }));
    expect(missing.ok && missing.value.durationSeconds).toBeNull();

    expect(normalizePaperAttemptInput(validBody({ durationSeconds: -1 })).ok).toBe(false);
    expect(normalizePaperAttemptInput(validBody({ durationSeconds: 1.5 })).ok).toBe(false);
  });

  it("startedAt：null 合法；非法字符串 / 空串 400", () => {
    const result = normalizePaperAttemptInput(validBody({ startedAt: null }));
    expect(result.ok && result.value.startedAt).toBeNull();
    expect(normalizePaperAttemptInput(validBody({ startedAt: "not-a-date" })).ok).toBe(false);
    expect(normalizePaperAttemptInput(validBody({ startedAt: "  " })).ok).toBe(false);
  });

  it("submittedAt 必填：缺失 / null / 非法 400", () => {
    expect(normalizePaperAttemptInput(validBody({ submittedAt: undefined })).ok).toBe(false);
    expect(normalizePaperAttemptInput(validBody({ submittedAt: null })).ok).toBe(false);
    expect(normalizePaperAttemptInput(validBody({ submittedAt: "2026-13-40" })).ok).toBe(false);
  });

  it("结构非法整体 400：null / 数组 / 字符串 / byPoint 非数组", () => {
    expect(normalizePaperAttemptInput(null).ok).toBe(false);
    expect(normalizePaperAttemptInput([]).ok).toBe(false);
    expect(normalizePaperAttemptInput("{}").ok).toBe(false);
    expect(normalizePaperAttemptInput(validBody({ byPoint: "[]" })).ok).toBe(false);
    expect(normalizePaperAttemptInput(validBody({ bySubject: { key: "x" } })).ok).toBe(false);
  });

  it("条目脏项丢弃：缺 key/title、wrong/total 非非负整数、非对象项", () => {
    const parsed = normalizePaperAttemptInput(
      validBody({
        byPoint: [
          { key: "ds-01", title: "线性表", wrong: 2, total: 10 },
          { key: "  ds-02  ", title: "  栈  ", wrong: 0, total: 5 },
          { title: "缺 key", wrong: 1, total: 3 },
          { key: "x", title: "", wrong: 1, total: 3 },
          { key: "y", title: "字符串 wrong", wrong: "1", total: 3 },
          { key: "z", title: "负 total", wrong: 1, total: -3 },
          null,
          "脏字符串",
        ],
      })
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.byPoint).toEqual([
      { key: "ds-01", title: "线性表", wrong: 2, total: 10 },
      { key: "ds-02", title: "栈", wrong: 0, total: 5 },
    ]);
  });
});

describe("normalizePaperAttemptBreakdown（读取侧复用）", () => {
  it("非数组统一返回空数组；脏条目丢弃", () => {
    expect(normalizePaperAttemptBreakdown(null)).toEqual([]);
    expect(normalizePaperAttemptBreakdown("[]")).toEqual([]);
    expect(
      normalizePaperAttemptBreakdown([
        { key: "ok", title: "合法", wrong: 1, total: 2 },
        { key: "bad" },
        { key: "bad2", title: "整数超上限", wrong: 1, total: 3_000_000_000 },
      ])
    ).toEqual([{ key: "ok", title: "合法", wrong: 1, total: 2 }]);
  });
});

describe("clampPaperAttemptLimit（默认 20，clamp 1..50）", () => {
  it("缺省 / 非法 → 默认 20", () => {
    expect(clampPaperAttemptLimit(undefined)).toBe(PAPER_ATTEMPT_DEFAULT_LIMIT);
    expect(clampPaperAttemptLimit(null)).toBe(PAPER_ATTEMPT_DEFAULT_LIMIT);
    expect(clampPaperAttemptLimit(Number.NaN)).toBe(PAPER_ATTEMPT_DEFAULT_LIMIT);
    expect(clampPaperAttemptLimit(Number.POSITIVE_INFINITY)).toBe(PAPER_ATTEMPT_DEFAULT_LIMIT);
  });

  it("小于 1 → 1，大于 50 → 50，正常值向下取整", () => {
    expect(clampPaperAttemptLimit(0)).toBe(PAPER_ATTEMPT_MIN_LIMIT);
    expect(clampPaperAttemptLimit(-5)).toBe(PAPER_ATTEMPT_MIN_LIMIT);
    expect(clampPaperAttemptLimit(999)).toBe(PAPER_ATTEMPT_MAX_LIMIT);
    expect(clampPaperAttemptLimit(20)).toBe(20);
    expect(clampPaperAttemptLimit(12.9)).toBe(12);
  });
});

describe("mapPaperAttemptRow（id 一律 string）", () => {
  it("bigint id / 数值型列 / jsonb 列统一映射", () => {
    expect(mapPaperAttemptRow(rowFixture)).toEqual({
      id: "7",
      year: 2016,
      score: 88,
      totalScore: 150,
      correct: 40,
      wrong: 5,
      unanswered: 2,
      durationSeconds: 7200,
      startedAt: "2026-11-03T02:00:00.000Z",
      submittedAt: "2026-11-03T04:05:00.000Z",
      byPoint: [{ key: "ds-01", title: "线性表", wrong: 2, total: 10 }],
      bySubject: [{ key: "data-structure", title: "数据结构", wrong: 3, total: 20 }],
    });
  });

  it("duration_seconds/started_at 为 null 时保持 null", () => {
    const attempt = mapPaperAttemptRow({
      ...rowFixture,
      duration_seconds: null,
      started_at: null,
    });
    expect(attempt.durationSeconds).toBeNull();
    expect(attempt.startedAt).toBeNull();
  });
});

describe("createPaperAttempt（写库）", () => {
  it("INSERT 带 user_id 与 jsonb cast，返回映射后的 attempt", async () => {
    queryMock.mockResolvedValueOnce({ rows: [rowFixture] } as never);

    const attempt = await createPaperAttempt("u-1", normalized());

    expect(attempt.id).toBe("7");
    expect(attempt.submittedAt).toBe("2026-11-03T04:05:00.000Z");
    expect(queryMock).toHaveBeenCalledTimes(1);

    const [sql, args] = queryMock.mock.calls[0];
    const text = String(sql);
    expect(text).toContain("INSERT INTO exam_408_paper_attempts");
    expect(text).toContain("user_id");
    expect(text).toContain("$11::jsonb");
    expect(text).toContain("$12::jsonb");
    expect(text).toContain("RETURNING");
    // 参数顺序即契约字段顺序；$1 必须是 userId（数据隔离）
    expect(args).toEqual([
      "u-1",
      2016,
      88,
      150,
      40,
      5,
      2,
      7200,
      "2026-11-03T02:00:00.000Z",
      "2026-11-03T04:05:00.000Z",
      JSON.stringify([{ key: "ds-01", title: "线性表", wrong: 2, total: 10 }]),
      JSON.stringify([{ key: "data-structure", title: "数据结构", wrong: 3, total: 20 }]),
    ]);
  });
});

describe("listPaperAttempts（读库）", () => {
  function mockQueries(total: number | string, rows: unknown[] = [rowFixture]) {
    queryMock.mockImplementation(((sql: string) => {
      if (/count\(\*\)/i.test(sql)) return Promise.resolve({ rows: [{ total }] });
      return Promise.resolve({ rows });
    }) as never);
  }

  it("按 user_id 过滤、submitted_at DESC, id DESC 排序，默认 limit 20", async () => {
    mockQueries("3");

    const result = await listPaperAttempts("u-1");

    expect(result.total).toBe(3);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].id).toBe("7");

    const calls = queryMock.mock.calls.map(([sql, args]) => [String(sql), args] as const);
    const countCall = calls.find(([sql]) => /count\(\*\)/i.test(sql));
    const listCall = calls.find(([sql]) => /ORDER BY submitted_at DESC/.test(sql));
    expect(countCall?.[1]).toEqual(["u-1"]);
    expect(countCall?.[0]).toContain("WHERE user_id = $1");
    expect(listCall?.[1]).toEqual(["u-1", PAPER_ATTEMPT_DEFAULT_LIMIT]);
    expect(listCall?.[0]).toContain("WHERE user_id = $1");
    expect(listCall?.[0]).toContain("ORDER BY submitted_at DESC, id DESC");
  });

  it("limit clamp：0 → 1、999 → 50、NaN → 20", async () => {
    mockQueries(0, []);
    await listPaperAttempts("u-1", { limit: 0 });
    await listPaperAttempts("u-1", { limit: 999 });
    await listPaperAttempts("u-1", { limit: Number.NaN });

    const limits = queryMock.mock.calls
      .filter(([sql]) => /LIMIT \$2/.test(String(sql)))
      .map(([, args]) => (args as unknown[])[1]);
    expect(limits).toEqual([PAPER_ATTEMPT_MIN_LIMIT, PAPER_ATTEMPT_MAX_LIMIT, PAPER_ATTEMPT_DEFAULT_LIMIT]);
  });

  it("空历史：attempts 空数组且 total 0", async () => {
    mockQueries(0, []);
    await expect(listPaperAttempts("u-1")).resolves.toEqual({ attempts: [], total: 0 });
  });
});
