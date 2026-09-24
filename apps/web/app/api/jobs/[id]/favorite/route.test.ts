import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { pgPool } from "@/lib/db";
import { POST } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const queryMock = vi.mocked(pgPool.query);
const ctx = { params: Promise.resolve({ id: "1" }) };

type Row = Record<string, unknown>;
interface Fake {
  jobExists?: boolean;
  favorite?: boolean;
  /** 该职位在 job_applications 里的阶段（undefined = 不在看板里） */
  appStage?: string;
}

/** 按 SQL 文本分派，避免 mockResolvedValueOnce 的顺序脆弱性 */
function fakeDb(f: Fake) {
  const calls: string[] = [];
  queryMock.mockImplementation((async (sql: string) => {
    const s = String(sql);
    calls.push(s);
    if (s.includes("FROM job_postings WHERE id = $1") && s.includes("SELECT 1")) {
      return { rows: f.jobExists === false ? [] : [{ id: 1 }] };
    }
    if (s.includes("SELECT 1 FROM job_favorites")) {
      return { rows: f.favorite ? [{ user_id: "u-1" }] : [] };
    }
    if (s.includes("DELETE FROM job_favorites")) return { rows: [], rowCount: 1 };
    if (s.includes("FROM job_applications a")) {
      return {
        rows: f.appStage
          ? [{ id: 9, job_id: 1, stage: f.appStage, note: "", applied_at: null, updated_at: new Date().toISOString(), job_title: "T", job_company: "C", job_city: "北京", job_salary: "", job_url: "", job_source: "" }]
          : [],
      };
    }
    if (s.includes("DELETE FROM job_applications")) return { rows: [], rowCount: 1 };
    if (s.includes("INSERT INTO job_favorites")) return { rows: [], rowCount: 1 };
    if (s.includes("INSERT INTO job_applications")) {
      return { rows: [{ id: 9, job_id: 1, stage: "favorite", note: "", applied_at: null, updated_at: new Date().toISOString() }] };
    }
    if (s.includes("SELECT title AS job_title")) {
      return { rows: [{ job_title: "T", job_company: "C", job_city: "北京", job_salary: "", job_url: "", job_source: "" }] };
    }
    throw new Error("unexpected query: " + s.slice(0, 90));
  }) as never);
  return calls;
}

beforeEach(() => vi.resetAllMocks());

describe("POST /api/jobs/[id]/favorite", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost"), ctx);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid id", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "0" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when job does not exist", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await POST(new Request("http://localhost"), ctx);
    expect(res.status).toBe(404);
  });

  it("unfavorites 且已推进到后续阶段时，保留求职进度", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const calls = fakeDb({ favorite: true, appStage: "interview1" });
    const res = await POST(new Request("http://localhost"), ctx);
    expect(await res.json()).toEqual({ favorited: false });
    expect(calls.some((c) => c.includes("DELETE FROM job_favorites"))).toBe(true);
    expect(calls.some((c) => c.includes("DELETE FROM job_applications"))).toBe(false);
  });

  it("unfavorites 且仍停在「收藏」阶段时，一并移出我的求职", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const calls = fakeDb({ favorite: true, appStage: "favorite" });
    const res = await POST(new Request("http://localhost"), ctx);
    expect(await res.json()).toEqual({ favorited: false });
    expect(calls.some((c) => c.includes("DELETE FROM job_applications"))).toBe(true);
  });

  it("收藏时同步写入我的求职（阶段=收藏）", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const calls = fakeDb({ favorite: false });
    const res = await POST(new Request("http://localhost"), ctx);
    expect(await res.json()).toEqual({ favorited: true });
    expect(calls.some((c) => c.includes("INSERT INTO job_favorites"))).toBe(true);
    // 关键回归：收藏必须出现在「我的求职」里（读的是 job_applications）
    expect(calls.some((c) => c.includes("INSERT INTO job_applications"))).toBe(true);
  });

  it("收藏已在求职看板里的职位时不覆盖其阶段", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const calls = fakeDb({ favorite: false, appStage: "offer" });
    const res = await POST(new Request("http://localhost"), ctx);
    expect(await res.json()).toEqual({ favorited: true });
    expect(calls.some((c) => c.includes("INSERT INTO job_applications"))).toBe(false);
  });
});
