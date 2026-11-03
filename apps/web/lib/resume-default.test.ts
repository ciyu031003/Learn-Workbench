import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { pgPool } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  RESUME_DEFAULT_MAX_ATTEMPTS,
  RESUME_DEFAULT_RETRY_DELAYS_MS,
  ensureSingleDefault,
} from "./resume-default";

const queryMock = vi.mocked(pgPool.query);
const logErrorMock = vi.mocked(logger.error);

/** 模拟 pg 抛出的唯一约束冲突（并发撞 uq_resume_files_default） */
function uniqueViolation(): Error {
  return Object.assign(new Error('duplicate key value violates unique constraint "uq_resume_files_default"'), {
    code: "23505",
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ensureSingleDefault（默认简历原子回溯）", () => {
  it("没有默认 → 一条语句完成判定 + 提升，返回被提升的 id（string）", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "9" }] } as never);

    await expect(ensureSingleDefault("u-1")).resolves.toBe("9");

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, args] = queryMock.mock.calls[0];
    const text = String(sql);
    // 原子性契约：判定（NOT EXISTS）与写入（is_default = true）在同一条语句内
    expect(text).toContain("WITH candidate AS");
    expect(text).toContain("NOT EXISTS");
    expect(text).toContain("is_default");
    expect(text).toContain("ORDER BY created_at DESC, id DESC");
    expect(text).toContain("RETURNING id::text AS id");
    expect(args).toEqual(["u-1"]);
  });

  it("没有简历（候选为空）→ 不提升，返回 null，只查一次库", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);

    await expect(ensureSingleDefault("u-1")).resolves.toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("非唯一冲突错误（如数据库不可用）→ 不重试，记日志并返回 null", async () => {
    queryMock.mockRejectedValueOnce(new Error("db down"));

    await expect(ensureSingleDefault("u-1")).resolves.toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });

  it("23505 一次 → 退避后重试成功，返回被提升的 id", async () => {
    queryMock
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce({ rows: [{ id: "7" }] } as never);

    await expect(ensureSingleDefault("u-1")).resolves.toBe("7");
    expect(queryMock).toHaveBeenCalledTimes(2);
    // 重试成功不应记 error
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it(`23505 连续 ${RESUME_DEFAULT_MAX_ATTEMPTS} 次 → 重试耗尽，只记一次日志并返回 null`, async () => {
    queryMock.mockRejectedValue(uniqueViolation());

    await expect(ensureSingleDefault("u-1")).resolves.toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(RESUME_DEFAULT_MAX_ATTEMPTS);
    expect(logErrorMock).toHaveBeenCalledTimes(1);
    expect(String(logErrorMock.mock.calls[0][0])).toContain("重试耗尽");
  });

  it("23505 的重试退避为 10ms / 30ms（假定时器验证时间点）", async () => {
    vi.useFakeTimers();
    queryMock.mockRejectedValue(uniqueViolation());

    const pending = ensureSingleDefault("u-1");
    await vi.advanceTimersByTimeAsync(0); // 让首次失败进入退避
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(RESUME_DEFAULT_RETRY_DELAYS_MS[0] - 1);
    expect(queryMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(queryMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(RESUME_DEFAULT_RETRY_DELAYS_MS[1] - 1);
    expect(queryMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(queryMock).toHaveBeenCalledTimes(3);

    await expect(pending).resolves.toBeNull();
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});
