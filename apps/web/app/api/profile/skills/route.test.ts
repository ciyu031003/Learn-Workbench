import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/skills", () => ({
  backfillUserSkillsFromResume: vi.fn(),
  listUserSkills: vi.fn(),
  setUserSkill: vi.fn(),
  removeUserSkill: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { backfillUserSkillsFromResume, listUserSkills, setUserSkill, removeUserSkill } from "@/lib/skills";
import { logger } from "@/lib/logger";
import { GET, POST, DELETE } from "./route";

const userIdMock = vi.mocked(currentUserId);
const listMock = vi.mocked(listUserSkills);
const backfillMock = vi.mocked(backfillUserSkillsFromResume);
const setMock = vi.mocked(setUserSkill);
const removeMock = vi.mocked(removeUserSkill);
const loggerErr = vi.mocked(logger.error);

beforeEach(() => {
  vi.clearAllMocks();
  userIdMock.mockResolvedValue("u-1");
  listMock.mockResolvedValue([{ id: 1, name: "react", category: "frontend", level: 3, source: "manual" }]);
});

describe("GET /api/profile/skills", () => {
  it("returns 401 when not authenticated", async () => {
    userIdMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "请先登录" });
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns the user skills list", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skills).toEqual([{ id: 1, name: "react", category: "frontend", level: 3, source: "manual" }]);
    expect(listMock).toHaveBeenCalledWith("u-1");
  });

  it("returns 500 when listing fails", async () => {
    listMock.mockRejectedValue(new Error("boom"));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "技能画像加载失败" });
    expect(loggerErr).toHaveBeenCalled();
  });
});

describe("POST /api/profile/skills", () => {
  it("returns 401 when not authenticated", async () => {
    userIdMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("backfills skills from resume when action=resume", async () => {
    backfillMock.mockResolvedValue(4);
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ action: "resume" }) }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, added: 4 });
    expect(backfillMock).toHaveBeenCalledWith("u-1");
  });

  it("sets a skill with clamped level", async () => {
    setMock.mockResolvedValue();
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ skillId: 7, level: 9 }) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(setMock).toHaveBeenCalledWith("u-1", 7, 5);
  });

  it("applies default level when level is invalid", async () => {
    setMock.mockResolvedValue();
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ skillId: 3 }) }));
    expect(res.status).toBe(200);
    expect(setMock).toHaveBeenCalledWith("u-1", 3, 2);
  });

  it("returns 400 for an invalid skillId", async () => {
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ skillId: "abc" }) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "skillId 无效" });
    expect(setMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a zero skillId", async () => {
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ skillId: 0 }) }));
    expect(res.status).toBe(400);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("returns 500 when setting fails", async () => {
    setMock.mockRejectedValue(new Error("boom"));
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ skillId: 2 }) }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "技能更新失败" });
    expect(loggerErr).toHaveBeenCalled();
  });
});

describe("DELETE /api/profile/skills", () => {
  it("returns 401 when not authenticated", async () => {
    userIdMock.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost/api/profile/skills?skillId=1", { method: "DELETE" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when skillId is missing", async () => {
    const res = await DELETE(new Request("http://localhost/api/profile/skills", { method: "DELETE" }));
    expect(res.status).toBe(400);
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("removes the skill", async () => {
    removeMock.mockResolvedValue();
    const res = await DELETE(new Request("http://localhost/api/profile/skills?skillId=9", { method: "DELETE" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(removeMock).toHaveBeenCalledWith("u-1", 9);
  });

  it("returns 500 when removal fails", async () => {
    removeMock.mockRejectedValue(new Error("boom"));
    const res = await DELETE(new Request("http://localhost/api/profile/skills?skillId=9", { method: "DELETE" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "技能移除失败" });
    expect(loggerErr).toHaveBeenCalled();
  });
});
