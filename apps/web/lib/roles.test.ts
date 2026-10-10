import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", () => ({ pgPool: { query: vi.fn() } }));

import { pgPool } from "./db";
import { ADMIN_ROLES, CONTENT_ROLES, hasRole, isRole, roleOf } from "./roles";

const queryMock = vi.mocked(pgPool.query);

beforeEach(() => vi.resetAllMocks());

describe("isRole", () => {
  it("只认四个已知角色", () => {
    for (const r of ["learner", "editor", "reviewer", "admin"]) expect(isRole(r)).toBe(true);
    for (const r of ["Admin", "root", "", null, undefined, 1, {}]) expect(isRole(r)).toBe(false);
  });
});

describe("roleOf", () => {
  it("读 users.role", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ role: "editor", is_admin: false }] } as never);
    expect(await roleOf("u1")).toBe("editor");
  });

  it("is_admin=true 视为 admin（存量兼容，即使 role 还是 learner）", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ role: "learner", is_admin: true }] } as never);
    expect(await roleOf("u1")).toBe("admin");
  });

  it("用户不存在 → learner（不默认给权限）", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    expect(await roleOf("ghost")).toBe("learner");
  });

  it("role 是脏数据 → 退化为 learner", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ role: "superuser", is_admin: false }] } as never);
    expect(await roleOf("u1")).toBe("learner");
  });
});

describe("hasRole", () => {
  it("未登录直接 false，不查库", async () => {
    expect(await hasRole(null, ADMIN_ROLES)).toBe(false);
    expect(await hasRole(undefined, CONTENT_ROLES)).toBe(false);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("角色命中允许集合 → true", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ role: "reviewer", is_admin: false }] } as never);
    expect(await hasRole("u1", CONTENT_ROLES)).toBe(true);
  });

  it("学习者不在内容运营集合里 → false", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ role: "learner", is_admin: false }] } as never);
    expect(await hasRole("u1", CONTENT_ROLES)).toBe(false);
    expect(CONTENT_ROLES).not.toContain("learner");
  });
});
