import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { computeRadar, radarFallback } from "./radar";

const queryMock = vi.mocked(pgPool.query);

interface Handlers {
  userSkills?: unknown[];
  profile?: unknown[];
  favorites?: unknown[];
  applications?: unknown[];
  fill?: unknown[];
  scored?: unknown[];
  hours?: unknown[];
  events?: unknown[];
}

/** 按 SQL 特征分派 mock 结果（调用顺序：user_skills/profile → favorites/applications/fill → scored → hours → events） */
function setup(h: Handlers) {
  queryMock.mockImplementation((sql: string) => {
    const s = String(sql);
    if (s.includes("FROM user_skills WHERE user_id = $1") && !s.includes("WITH")) {
      return Promise.resolve({ rows: h.userSkills ?? [] } as never);
    }
    if (s.includes("FROM user_settings")) return Promise.resolve({ rows: h.profile ?? [] } as never);
    if (s.includes("FROM job_favorites")) return Promise.resolve({ rows: h.favorites ?? [] } as never);
    if (s.includes("FROM job_applications")) return Promise.resolve({ rows: h.applications ?? [] } as never);
    if (s.includes("SELECT id FROM job_postings")) return Promise.resolve({ rows: h.fill ?? [] } as never);
    if (s.includes("WITH my_skills")) return Promise.resolve({ rows: h.scored ?? [] } as never);
    if (s.includes("FROM skill_content_links")) return Promise.resolve({ rows: h.hours ?? [] } as never);
    if (s.includes("FROM job_exam_events")) return Promise.resolve({ rows: h.events ?? [] } as never);
    return Promise.resolve({ rows: [] } as never);
  });
}

function scoredRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1, title: "网络安全工程师", company: "某国企", city: "乌鲁木齐", education: "本科",
    salary_text: "12-18K", salary_band: "10-20K", url: "https://x", source: "lagou",
    published_at: new Date("2026-09-01T00:00:00Z"),
    total_weight: 2, hit_weight: 2, missing: [], matched: ["python", "linux"],
    ...over,
  };
}

beforeEach(() => vi.resetAllMocks());

describe("computeRadar", () => {
  it("scores a full skill hit with matching city at 100", async () => {
    setup({
      userSkills: [{ skill_id: 1, level: 3 }],
      profile: [{ city: "乌鲁木齐", targetRole: "安全工程师" }],
      favorites: [{ job_id: "1" }],
      scored: [scoredRow()],
    });
    const r = await computeRadar("u-1");
    expect(r.hasProfile).toBe(true);
    expect(r.profileCity).toBe("乌鲁木齐");
    // 技能 1.0*0.7 + 学历 0.1 + 经验 0.1 + 城市 1*0.1 = 1.0
    expect(r.top[0].overall).toBe(100);
    expect(r.top[0].fromFavorite).toBe(true);
    expect(r.top[0].matchedSkills.map((s) => s.skill)).toEqual(["python", "linux"]);
  });

  it("penalizes city mismatch and partial skill hits", async () => {
    setup({
      userSkills: [{ skill_id: 1, level: 1 }],
      profile: [{ city: "北京", targetRole: null }],
      favorites: [{ job_id: "1" }],
      // 命中一半权重 → 0.5*0.7=0.35 + 0.1 + 0.1 + 0 = 0.55
      scored: [scoredRow({ total_weight: 2, hit_weight: 1, matched: ["python"], missing: ["linux"] })],
    });
    const r = await computeRadar("u-1");
    expect(r.top[0].overall).toBe(55);
    expect(r.top[0].missingSkills).toEqual([{ skill: "linux" }]);
  });

  it("uses 0.5 city credit when the profile has no city", async () => {
    setup({
      userSkills: [{ skill_id: 1, level: 3 }],
      profile: [],
      favorites: [{ job_id: "1" }],
      scored: [scoredRow({ total_weight: 2, hit_weight: 2 })],
    });
    const r = await computeRadar("u-1");
    // 1.0*0.7 + 0.1 + 0.1 + 0.5*0.1 = 0.95
    expect(r.top[0].overall).toBe(95);
    expect(r.profileCity).toBeNull();
  });

  it("buckets high-match, high-value and urgent jobs", async () => {
    const soon = new Date(Date.now() + 2 * 86_400_000);
    setup({
      userSkills: [{ skill_id: 1, level: 3 }],
      profile: [{ city: "乌鲁木齐", targetRole: null }],
      favorites: [{ job_id: "1" }],
      scored: [
        scoredRow({ id: 1, total_weight: 2, hit_weight: 2, salary_band: "30-50K" }),
        scoredRow({ id: 2, total_weight: 2, hit_weight: 1.2, salary_band: "30-50K" }),
      ],
      hours: [{ name: "linux", hours: 8 }],
      events: [{ job_id: "2", event_at: soon }],
    });
    const r = await computeRadar("u-1");
    // 100 分岗位进入高匹配
    expect(r.buckets.highMatch.map((j) => j.jobId)).toContain(1);
    // 30-50K 且 >=55 分进入高价值
    expect(r.buckets.highValue.map((j) => j.jobId)).toEqual(expect.arrayContaining([1, 2]));
    // 2 天后截止进入紧急
    expect(r.buckets.urgent.map((j) => j.jobId)).toEqual([2]);
    expect(r.buckets.urgent[0].deadlineLabel).toBe("2 天后截止");
  });

  it("weights gap hours from skill_content_links", async () => {
    setup({
      userSkills: [{ skill_id: 1, level: 3 }],
      profile: [{ city: null, targetRole: null }],
      favorites: [{ job_id: "1" }],
      scored: [scoredRow({ total_weight: 2, hit_weight: 1, matched: ["python"], missing: ["linux", "k8s"] })],
      hours: [{ name: "linux", hours: 8 }, { name: "k8s", hours: 12 }],
    });
    const r = await computeRadar("u-1");
    expect(r.top[0].gapHours).toBe(20);
  });

  it("returns empty result when there are no candidates", async () => {
    setup({ userSkills: [{ skill_id: 1, level: 2 }], profile: [], favorites: [], applications: [], fill: [] });
    const r = await computeRadar("u-1");
    expect(r.top).toEqual([]);
    expect(r.counts.candidates).toBe(0);
    expect(r.hasProfile).toBe(true);
  });

  it("marks hasProfile false when the user has no skills", async () => {
    setup({ userSkills: [], profile: [{ city: "北京", targetRole: null }], fill: [{ id: "1" }], scored: [scoredRow()] });
    const r = await computeRadar("u-1");
    expect(r.hasProfile).toBe(false);
  });

  it("counts favorites and applications separately", async () => {
    setup({
      userSkills: [{ skill_id: 1, level: 2 }],
      profile: [],
      favorites: [{ job_id: "1" }],
      applications: [{ job_id: "2" }],
      fill: [{ id: "3" }],
      scored: [scoredRow({ id: 1 }), scoredRow({ id: 2 }), scoredRow({ id: 3 })],
    });
    const r = await computeRadar("u-1");
    expect(r.counts.favorites).toBe(1);
    expect(r.counts.applications).toBe(1);
    expect(r.counts.candidates).toBe(3);
    expect(r.top.find((j) => j.jobId === 2)?.fromApplication).toBe(true);
  });

  it("respects the limit option", async () => {
    setup({
      userSkills: [{ skill_id: 1, level: 2 }],
      profile: [],
      favorites: [{ job_id: "1" }],
      scored: [scoredRow({ id: 1 }), scoredRow({ id: 2 }), scoredRow({ id: 3 })],
    });
    const r = await computeRadar("u-1", { limit: 2 });
    expect(r.top).toHaveLength(2);
  });
});

describe("radarFallback", () => {
  it("returns active jobs by city without scores", async () => {
    queryMock.mockResolvedValue({
      rows: [scoredRow({ total_weight: null, hit_weight: null, matched: null, missing: null })],
    } as never);
    const r = await radarFallback({ city: "北京" });
    expect(r.hasProfile).toBe(false);
    expect(r.profileCity).toBe("北京");
    expect(r.top[0].overall).toBe(0);
    expect(r.top[0].title).toBe("网络安全工程师");
  });

  it("returns empty result when the query fails", async () => {
    queryMock.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await radarFallback({});
    expect(r.top).toEqual([]);
    expect(r.counts.candidates).toBe(0);
  });
});