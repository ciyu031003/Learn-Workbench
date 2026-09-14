import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ scopeWhere: vi.fn() }));
import { pgPool } from "@/lib/db";
import { scopeWhere } from "@/lib/anon";
import { assembleResumeContent, parseSectionOrder, parseStyles } from "./resume";

const queryMock = vi.mocked(pgPool.query);
const scopeWhereMock = vi.mocked(scopeWhere);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
});

function routeBySql(handlers: { match: string; rows: unknown[] }[]) {
  queryMock.mockImplementation((sql: string) => {
    const h = handlers.find((x) => String(sql).includes(x.match));
    return Promise.resolve({ rows: h?.rows ?? [] } as never);
  });
}

describe("parseSectionOrder", () => {
  it("fills missing keys and drops invalid ones in default order", () => {
    const out = parseSectionOrder([
      { key: "projects", visible: false },
      { key: "bogus" },
      "skills",
    ]);
    const keys = out.map((s) => s.key);
    expect(keys[0]).toBe("projects");
    expect(out[0].visible).toBe(false);
    expect(keys).toContain("skills");
    // 全部 6 个分节都被补齐
    expect(out).toHaveLength(6);
    expect(keys).not.toContain("bogus");
  });

  it("deduplicates repeated keys", () => {
    const out = parseSectionOrder(["skills", "skills"]);
    expect(out.filter((s) => s.key === "skills")).toHaveLength(1);
  });

  it("returns full default order for non-array input", () => {
    expect(parseSectionOrder(null)).toHaveLength(6);
    expect(parseSectionOrder(undefined).map((s) => s.key)).toEqual([
      "basics", "education", "skills", "experience", "projects", "certificates",
    ]);
  });
});

describe("parseStyles", () => {
  it("merges template defaults with document styles", () => {
    const out = parseStyles("classic", { accent: "#123456", fontScale: 1.1 });
    expect(out.accent).toBe("#123456");
    expect(out.fontScale).toBe(1.1);
    expect(out.spacing).toBe("normal");
  });

  it("clamps fontScale outside the allowed range", () => {
    const out = parseStyles("classic", { fontScale: 9 });
    // 越界 → zod 校验失败，回落到模板默认（无 fontScale 时 undefined）
    expect(out.fontScale === undefined || (out.fontScale >= 0.8 && out.fontScale <= 1.3)).toBe(true);
  });

  it("falls back to classic for unknown template keys", () => {
    const out = parseStyles("does-not-exist", {});
    expect(out.accent).toBe("#2f74c0");
  });
});

describe("assembleResumeContent", () => {
  it("assembles profile, skills, projects and certificates from their domains", async () => {
    routeBySql([
      {
        match: "FROM user_settings",
        rows: [{
          bio: "一句话简介", currentCity: "乌鲁木齐", targetRole: "安全工程师",
          education: [{ school: "X 大学", major: "信息安全", degree: "本科", start: "2020", end: "2024", note: null }],
          experiences: [{ title: "后端", org: "某公司", start: "2024", end: null, description: "做了些事", skills: [] }],
          displayName: "张三", email: "z@example.com",
        }],
      },
      { match: "FROM user_skills", rows: [{ name: "Linux", level: 3, category: "ops" }] },
      { match: "FROM resume_assets", rows: [{ title: "工作台", content: "项目", url: null, kind: "project" }] },
      { match: "FROM certificates", rows: [{ name: "CISP", issuer: "测评中心", earnedDate: "2025-09-30", expiryDate: "2028-09-30" }] },
    ]);

    const c = await assembleResumeContent({ uid: "u-1", anonId: null });
    expect(c.basics.name).toBe("张三");
    expect(c.basics.city).toBe("乌鲁木齐");
    expect(c.education).toHaveLength(1);
    expect(c.experience).toHaveLength(1);
    expect(c.skills).toEqual([{ name: "Linux", level: 3, category: "ops" }]);
    expect(c.projects[0].title).toBe("工作台");
    // 日期列被归一化为 YYYY-MM-DD
    expect(c.certificates[0].earnedDate).toBe("2025-09-30");
  });

  it("falls back to resume_assets skills when user_skills is empty", async () => {
    queryMock.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes("FROM user_skills")) return Promise.resolve({ rows: [] } as never);
      if (s.includes("kind = 'skill'")) return Promise.resolve({ rows: [{ title: "Docker" }] } as never);
      return Promise.resolve({ rows: [] } as never);
    });
    const c = await assembleResumeContent({ uid: "u-1", anonId: null });
    expect(c.skills).toEqual([{ name: "Docker", level: 0, category: "" }]);
  });

  it("returns empty sections for an anonymous scope with no data", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const c = await assembleResumeContent({ uid: null, anonId: "anon-1" });
    expect(c.education).toEqual([]);
    expect(c.projects).toEqual([]);
    expect(c.certificates).toEqual([]);
    expect(c.basics.name).toBe("");
  });
});