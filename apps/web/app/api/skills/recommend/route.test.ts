import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.resetAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("GET /api/skills/recommend", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns career recommendations based on settings.career", async () => {
    // 1) settings.career → frontend, 2) careers.name, 3..n) ensureSkill per recommended skill
    queryMock
      .mockResolvedValueOnce({ rows: [{ value: "frontend" }] } as never)
      .mockResolvedValueOnce({ rows: [{ name: "前端开发工程师" }] } as never)
      .mockResolvedValue({ rows: [{ id: 7 }] } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.career).toBe("frontend");
    expect(body.careerName).toBe("前端开发工程师");
    expect(body.skills.length).toBeGreaterThan(5);
    expect(body.skills[0]).toMatchObject({ id: 7, name: "html", category: "frontend" });
  });

  it("defaults to ict recommendations when no career set", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ name: "ICT 学习规划" }] } as never)
      .mockResolvedValue({ rows: [{ id: 1 }] } as never);
    const res = await GET();
    const body = await res.json();
    expect(body.career).toBe("ict");
    expect(body.skills.length).toBeGreaterThan(5);
  });
});
