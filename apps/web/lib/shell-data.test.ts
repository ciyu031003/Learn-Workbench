import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUser: vi.fn() }));

import { pgPool } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { downloadUrlFromEnv, getShellData, resolveDownloadUrl } from "./shell-data";

const queryMock = vi.mocked(pgPool.query);
const userMock = vi.mocked(currentUser);

beforeEach(() => {
  vi.resetAllMocks();
  userMock.mockResolvedValue({ id: "u-1", username: "alice", displayName: "Alice" });
  queryMock.mockImplementation((sql: string) => {
    const s = String(sql);
    if (s.includes("FROM careers")) {
      return Promise.resolve({
        rows: [
          { career_key: "ict", name: "ICT 学习规划", kind: "career", icon: "cpu", color: "#123456", is_locked: true },
          { career_key: "custom-a", name: "自建域", kind: "custom", icon: null, color: null, is_locked: false },
        ],
      });
    }
    if (s.includes("FROM settings")) return Promise.resolve({ rows: [{ value: "custom-a" }] });
    if (s.includes("FROM content_topics")) return Promise.resolve({ rows: [{ total: 4, done: 3 }] });
    return Promise.resolve({ rows: [] });
  });
});

describe("resolveDownloadUrl", () => {
  it("只接受 http(s) 绝对地址", () => {
    expect(resolveDownloadUrl("https://learn.yuanabd.cn/download.html")).toBe("https://learn.yuanabd.cn/download.html");
    expect(resolveDownloadUrl("http://127.0.0.1:3001/download.html")).toBe("http://127.0.0.1:3001/download.html");
    expect(resolveDownloadUrl("  ")).toBeNull();
    expect(resolveDownloadUrl("/download.html")).toBeNull();
    expect(resolveDownloadUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("downloadUrlFromEnv", () => {
  it("优先 NEXT_PUBLIC_DOWNLOAD_URL，兼容 DOWNLOAD_URL，未配为空", () => {
    expect(downloadUrlFromEnv({ NEXT_PUBLIC_DOWNLOAD_URL: "https://a.test/d.html" })).toBe("https://a.test/d.html");
    expect(downloadUrlFromEnv({ DOWNLOAD_URL: "https://b.test/d.html" })).toBe("https://b.test/d.html");
    expect(downloadUrlFromEnv({})).toBeNull();
    expect(downloadUrlFromEnv({ NEXT_PUBLIC_DOWNLOAD_URL: "  " })).toBeNull();
  });
});

describe("getShellData", () => {
  it("未登录返回 null（layout 负责重定向）", async () => {
    userMock.mockResolvedValue(null);
    await expect(getShellData()).resolves.toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("返回纯数据：user/domains/currentCareer/overallPercent/downloadUrl", async () => {
    const prev = process.env["NEXT_PUBLIC_DOWNLOAD_URL"];
    process.env["NEXT_PUBLIC_DOWNLOAD_URL"] = "https://learn.yuanabd.cn/download.html";
    try {
      const data = await getShellData();
      expect(data).not.toBeNull();
      expect(data!.user).toEqual({ id: "u-1", username: "alice", displayName: "Alice" });
      expect(data!.domains).toEqual([
        { careerKey: "ict", name: "ICT 学习规划", color: "#123456", icon: "cpu", kindLabel: "职业成长", isLocked: true },
        { careerKey: "custom-a", name: "自建域", color: "#6366f1", icon: "compass", kindLabel: "自定义", isLocked: false },
      ]);
      expect(data!.currentCareer).toBe("custom-a");
      expect(data!.overallPercent).toBe(75);
      expect(data!.downloadUrl).toBe("https://learn.yuanabd.cn/download.html");
      // 领域查询按 user 作用域过滤
      const careerCall = queryMock.mock.calls.find(([sql]) => String(sql).includes("FROM careers"));
      expect(careerCall?.[1]).toEqual(["u-1"]);
    } finally {
      if (prev === undefined) delete process.env["NEXT_PUBLIC_DOWNLOAD_URL"];
      else process.env["NEXT_PUBLIC_DOWNLOAD_URL"] = prev;
    }
  });

  it("可选数据查询失败时降级（不把整页壳打崩）", async () => {
    queryMock.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes("FROM careers")) return Promise.reject(new Error("boom"));
      if (s.includes("FROM settings")) return Promise.reject(new Error("boom"));
      if (s.includes("FROM content_topics")) return Promise.reject(new Error("boom"));
      return Promise.resolve({ rows: [] });
    });
    const data = await getShellData();
    expect(data).toMatchObject({ domains: [], currentCareer: "ict", overallPercent: 0 });
  });
});
