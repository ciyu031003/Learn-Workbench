import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 端到端回归（**不 mock `@/lib/anon` / `@/lib/session`**）：
 * 完全没有任何 cookie 与 Authorization 头时，路由必须返回 200 空结果，而不是 500。
 *
 * 2026-09-15 生产事故：这类请求会走进 `userScope()` → `currentUserId()` →
 * `hashToken(null)` → `createHash().update(null)` 抛 `ERR_INVALID_ARG_TYPE`，
 * 于是 habits / certificates / nutrition / workouts / trackers / nutrition-summary
 * 对未登录用户全 500（带任意非空 Bearer 反而 200）。
 *
 * 现有的 `route.test.ts` 全都 mock 了 `userScope`，因此**永远测不到这条路径** ——
 * 这个文件专门补上这一课。
 */
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));

import { pgPool } from "@/lib/db";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);

beforeEach(() => {
  vi.resetAllMocks();
  queryMock.mockResolvedValue({ rows: [] } as never);
});

describe("匿名请求（无 cookie / 无 Authorization）走真实 userScope", () => {
  it("返回 200 与空汇总，而不是 500", async () => {
    const res = await GET(new Request("http://localhost/api/nutrition/summary?days=7"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toBe(7);
    expect(body.summary).toEqual([]);
  });

  it("作用域参数为「无用户 + 无匿名设备」，且不查会话表", async () => {
    await GET(new Request("http://localhost/api/nutrition/summary?days=7"));
    const sql = String(queryMock.mock.calls[0][0]);
    // 统计查询只打 meal_entries（不该出现 sessions 查询）
    expect(sql).toContain("meal_entries");
    expect(sql).not.toContain("FROM sessions");
    // params: [uid=null, days=7, anonId=null]
    expect(queryMock.mock.calls[0][1]).toEqual([null, 7, null]);
  });
});
