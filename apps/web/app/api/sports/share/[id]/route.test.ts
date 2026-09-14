import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.resetAllMocks());

describe("GET /api/sports/share/[id]", () => {
  it("returns only whitelisted fields for a public profile", async () => {
    queryMock.mockResolvedValue({
      rows: [{
        sportKey: "badminton", identity: "双打搭子", levelText: "中羽 1 级", handedness: "right",
        playStyle: "混双", photoUrl: "https://x/p.jpg",
        gear: [{ label: "球拍", value: "雷霆80" }], highlights: [{ label: "校赛", value: "亚军" }],
        displayName: "张三",
      }],
    } as never);
    const res = await GET(new Request("http://localhost"), ctx("1"));
    expect(res.status).toBe(200);
    const { share } = await res.json();
    expect(share.sportName).toBe("羽毛球");
    expect(share.identity).toBe("双打搭子");
    expect(share.gear).toHaveLength(1);
    // 脱敏断言：绝不出现体重/年龄/身体测量/饮食/训练细节字段
    for (const forbidden of ["weightKg", "weight", "age", "bodyMeasurements", "meals", "nutrition", "workouts", "note"]) {
      expect(share).not.toHaveProperty(forbidden);
    }
  });

  it("looks up by share slug for non-numeric ids", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await GET(new Request("http://localhost"), ctx("sp-abc123"));
    expect(String(queryMock.mock.calls[0][0])).toContain("p.share_slug = $1");
  });

  it("looks up by numeric id", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await GET(new Request("http://localhost"), ctx("42"));
    expect(String(queryMock.mock.calls[0][0])).toContain("p.id = $1");
  });

  it("404 for a non-public or missing profile", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost"), ctx("1"));
    expect(res.status).toBe(404);
  });

  it("only queries public, non-deleted profiles", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await GET(new Request("http://localhost"), ctx("1"));
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("p.is_public = true");
    expect(sql).toContain("p.deleted_at IS NULL");
  });
});