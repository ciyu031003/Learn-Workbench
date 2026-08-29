import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { normalizeSkillTag, computeJobMatch, computeSkillGaps, enrollGapsToTasks, backfillJobSkillLinks, backfillUserSkillsFromResume, listUserSkills, setUserSkill, removeUserSkill } from "./skills";

const queryMock = vi.mocked(pgPool.query);
// resetAllMocks 会清空 mockResolvedValueOnce 队列（clearAllMocks 不会），
// 避免上一个用例未消费的 once mock 泄漏到下一个用例
beforeEach(() => vi.resetAllMocks());

describe("normalizeSkillTag (P2)", () => {
  it("matches exact name", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ name: "redis" }] } as never)
      .mockResolvedValue({ rows: [] } as never);
    expect(await normalizeSkillTag("redis")).toBe("redis");
  });

  it("matches alias case-insensitively", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ name: "python" }] } as never)
      .mockResolvedValue({ rows: [] } as never);
    expect(await normalizeSkillTag("Python")).toBe("python");
  });

  it("returns null for unknown", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    expect(await normalizeSkillTag("totally-unknown-skill")).toBeNull();
  });
});

describe("computeJobMatch (P2)", () => {
  it("computes skill-based match with user levels", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { skill_id: 1, name: "python", weight: 1 },
          { skill_id: 2, name: "redis", weight: 1 },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          { skill_id: 1, level: 3 },
          { skill_id: 2, level: 1 },
        ],
      } as never);
    const m = await computeJobMatch("u-1", 10);
    expect(m.overall).toBeGreaterThan(0);
    expect(m.matchedSkills.some((s) => s.skill === "python" && s.hit)).toBe(true);
    expect(m.matchedSkills.some((s) => s.skill === "redis" && s.partial)).toBe(true);
    expect(m.missingSkills).toHaveLength(0);
  });

  it("reports missing skills when user has no profile", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ skill_id: 1, name: "k8s", weight: 1 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const m = await computeJobMatch(null, 11);
    expect(m.missingSkills).toEqual([{ skill: "k8s" }]);
    expect(m.hasUserProfile).toBe(false);
  });
});

describe("computeSkillGaps (P2)", () => {
  it("returns gaps with content mapping", async () => {
    // computeSkillGaps → computeJobMatch: 1) job_skill_links, 2) user_skills, then 3) skill_content_links
    queryMock
      .mockResolvedValueOnce({ rows: [{ skill_id: 1, name: "docker", weight: 1 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [{ skill_id: 1, name: "docker", topic_id: 403, topic_title: "批量运维工具", estimate_hours: 8 }],
      } as never);
    const { gaps, totalHours } = await computeSkillGaps("u-1", 10);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].skill).toBe("docker");
    expect(gaps[0].topicId).toBe(403);
    expect(gaps[0].enrollable).toBe(true);
    expect(totalHours).toBe(8);
  });
});

describe("enrollGapsToTasks (P2)", () => {
  it("creates daily tasks for gaps", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const created = await enrollGapsToTasks("u-1", [{ skill: "docker", topicId: 403, hours: 8 }]);
    expect(created).toBe(1);
    const insert = queryMock.mock.calls.find((c) => String(c[0]).includes("INSERT INTO daily_tasks"));
    expect(insert).toBeTruthy();
  });
});


describe("backfillJobSkillLinks (P0)", () => {
  it("links known tags and skips unknown ones", async () => {
    queryMock.mockImplementation((sql: string, params: unknown[] = []) => {
      if (sql.includes("FROM job_postings j")) return Promise.resolve({ rows: [{ id: 1, tags: ["redis", "bogus"] }] } as never);
      if (sql.includes("FROM skill_taxonomy WHERE lower(name)")) return Promise.resolve({ rows: params[0] === "redis" ? [{ name: "redis" }] : [] } as never);
      if (sql.includes("jsonb_array_elements_text")) return Promise.resolve({ rows: [] } as never);
      if (sql.includes("LIKE '%' || lower(name)")) return Promise.resolve({ rows: [] } as never);
      if (sql.includes("INSERT INTO skill_taxonomy")) return Promise.resolve({ rows: [{ id: 5 }] } as never);
      return Promise.resolve({ rows: [] } as never);
    });
    const linked = await backfillJobSkillLinks(10);
    expect(linked).toBe(1);
    const link = queryMock.mock.calls.find((c) => String(c[0]).includes("INSERT INTO job_skill_links"));
    expect(link?.[1]).toEqual([1, 5]);
  });

  it("returns 0 when there are no unlinked jobs", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    expect(await backfillJobSkillLinks()).toBe(0);
  });
});

describe("backfillUserSkillsFromResume (P0)", () => {
  it("backfills recognised resume skills", async () => {
    queryMock.mockImplementation((sql: string, params: unknown[] = []) => {
      if (sql.includes("FROM resume_assets")) return Promise.resolve({ rows: [{ title: "python" }, { title: "??" }] } as never);
      if (sql.includes("FROM skill_taxonomy WHERE lower(name)")) return Promise.resolve({ rows: params[0] === "python" ? [{ name: "python" }] : [] } as never);
      if (sql.includes("jsonb_array_elements_text")) return Promise.resolve({ rows: [] } as never);
      if (sql.includes("LIKE '%' || lower(name)")) return Promise.resolve({ rows: [] } as never);
      if (sql.includes("INSERT INTO skill_taxonomy")) return Promise.resolve({ rows: [{ id: 7 }] } as never);
      return Promise.resolve({ rows: [] } as never);
    });
    const added = await backfillUserSkillsFromResume("u-1");
    expect(added).toBe(1);
    const insert = queryMock.mock.calls.find((c) => String(c[0]).includes("INSERT INTO user_skills"));
    expect(insert?.[1]).toEqual(["u-1", 7]);
  });

  it("returns 0 when there are no resume skills", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    expect(await backfillUserSkillsFromResume("u-1")).toBe(0);
  });
});

describe("user skill CRUD", () => {
  it("lists user skills mapped to view shape", async () => {
    queryMock.mockResolvedValue({ rows: [
      { id: 1, name: "react", category: "frontend", level: 3, source: "manual" },
      { id: 2, name: "git", category: "soft", level: 2, source: "resume" },
    ] } as never);
    const skills = await listUserSkills("u-1");
    expect(skills).toEqual([
      { id: 1, name: "react", category: "frontend", level: 3, source: "manual" },
      { id: 2, name: "git", category: "soft", level: 2, source: "resume" },
    ]);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("FROM user_skills us"), ["u-1"]);
  });

  it("sets a user skill with explicit source", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await setUserSkill("u-1", 5, 4, "manual");
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO user_skills"),
      ["u-1", 5, 4, "manual"]
    );
  });

  it("sets a user skill with the default source", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await setUserSkill("u-1", 5, 4);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO user_skills"),
      ["u-1", 5, 4, "manual"]
    );
  });

  it("removes a user skill", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await removeUserSkill("u-1", 5);
    expect(queryMock).toHaveBeenCalledWith(
      "DELETE FROM user_skills WHERE user_id = $1 AND skill_id = $2",
      ["u-1", 5]
    );
  });
});

