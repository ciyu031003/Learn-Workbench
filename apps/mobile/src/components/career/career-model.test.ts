import { describe, expect, it } from "vitest";
import {
  buildApplicationFunnel,
  buildDeadlines,
  buildGapSkillItems,
  buildSubtitle,
  countGapSkills,
  countResumeMissingKinds,
  countStages,
  pickWeakest,
  resolveApplicationStateText,
  resolveGoalVerdict,
  resolveHighMatchCount,
  resolveStageIndex,
  sumGapHours,
  uniqueGapSkillNames,
  type RadarJobLite,
  type RadarSummary,
} from "./career-model";

/**
 * 职业页纯数据层的回归测试。
 *
 * 重点锁住两个曾经出过错/最容易出错的地方：
 * 1) resolveHighMatchCount —— 旧实现读 radar.buckets.highMatch（API 从未返回该字段），
 *    导致「高匹配」长期显示"待匹配"；这里锁住 counts.matched 优先 + top 回退 + 无画像 null。
 * 2) buildDeadlines / uniqueGapSkillNames —— 都是 slice 截断 + 去重，容易在"少于 N 条"时越界。
 */

const job = (over: Partial<RadarJobLite> = {}): RadarJobLite => ({
  jobId: 1,
  title: "前端工程师",
  company: "某公司",
  deadlineLabel: null,
  gapHours: 0,
  missingSkills: [],
  ...over,
});

describe("resolveHighMatchCount（历史 bug 回归）", () => {
  it("优先使用 counts.matched（API 的真实字段）", () => {
    const radar: RadarSummary = { hasProfile: true, counts: { matched: 7 }, top: [job(), job()] };
    expect(resolveHighMatchCount(radar)).toBe(7);
  });

  it("counts 缺失时回退到 top 长度", () => {
    const radar: RadarSummary = { hasProfile: true, top: [job(), job(), job()] };
    expect(resolveHighMatchCount(radar)).toBe(3);
  });

  it("没有画像时为 null（UI 显示「—」而不是 0）", () => {
    expect(resolveHighMatchCount({ hasProfile: false, top: [job()] })).toBeNull();
    expect(resolveHighMatchCount(null)).toBeNull();
  });

  it("matched 为 0 时如实返回 0，而不是回退 top", () => {
    expect(resolveHighMatchCount({ hasProfile: true, counts: { matched: 0 }, top: [job(), job()] })).toBe(0);
  });
});

describe("buildDeadlines", () => {
  it("只取有截止文案的岗位，最多 3 个，保持服务端顺序", () => {
    const rows = buildDeadlines([
      job({ jobId: 1, title: "A", deadlineLabel: "3 天后截止" }),
      job({ jobId: 2, title: "B", deadlineLabel: null }),
      job({ jobId: 3, title: "C", deadlineLabel: "5 天后截止" }),
      job({ jobId: 4, title: "D", deadlineLabel: "7 天后截止" }),
      job({ jobId: 5, title: "E", deadlineLabel: "9 天后截止" }),
    ]);
    expect(rows.map((r) => r.title)).toEqual(["A", "C", "D"]);
    expect(rows[0]).toEqual({ key: "1", title: "A", company: "某公司", deadlineLabel: "3 天后截止" });
  });

  it("没有截止信息的岗位时返回空数组", () => {
    expect(buildDeadlines([job(), job()])).toEqual([]);
    expect(buildDeadlines([])).toEqual([]);
  });
});

describe("技能差距聚合", () => {
  it("缺失技能去重且最多 3 个", () => {
    const rows = [
      job({ missingSkills: [{ skill: "K8s" }, { skill: "React" }] }),
      job({ missingSkills: [{ skill: "K8s" }, { skill: "TypeScript" }, { skill: "Redis" }] }),
    ];
    expect(uniqueGapSkillNames(rows)).toEqual(["K8s", "React", "TypeScript"]);
  });

  it("缺口小时四舍五入求和", () => {
    expect(sumGapHours([job({ gapHours: 1.2 }), job({ gapHours: 2.6 })])).toBe(4);
    expect(sumGapHours([])).toBe(0);
  });
});

describe("技能画像派生", () => {
  it("低于 Lv3 才算差距，按等级升序、同级按名称，最多 5 条", () => {
    const tones = { danger: "red", warning: "amber" };
    const skills = [
      { id: 1, name: "Zeta", level: 2, category: "frame" },
      { id: 2, name: "Alpha", level: 2, category: "frame" },
      { id: 3, name: "Zero", level: 0, category: "lang" },
      { id: 4, name: "Full", level: 3, category: "lang" },
    ] as never;
    expect(countGapSkills(skills)).toBe(3);
    const items = buildGapSkillItems(skills, tones);
    expect(items.map((i) => i.label)).toEqual(["Zero", "Alpha", "Zeta"]);
    expect(items[0].color).toBe("red");
    expect(items[1].color).toBe("amber");
    expect(items[1].value).toBe(1);
    expect(items[1].valueLabel).toBe("Lv 2");
  });
});

describe("投递漏斗与阶段", () => {
  it("按最靠后的阶段返回索引", () => {
    expect(resolveStageIndex(null)).toBe(0);
    expect(resolveStageIndex({ applied: 2 })).toBe(1);
    expect(resolveStageIndex({ applied: 2, online_test: 1 })).toBe(2);
    expect(resolveStageIndex({ interview1: 1 })).toBe(3);
    expect(resolveStageIndex({ offer: 1 })).toBe(4);
  });

  it("countStages 在无数据时是 null（不能显示 0）", () => {
    expect(countStages(null, ["applied"])).toBeNull();
    expect(countStages({ applied: 2, closed: 1 }, ["applied", "closed"])).toBe(3);
  });

  it("漏斗逐级只增不减，且没有投递时计数为 null", () => {
    const funnel = buildApplicationFunnel({ applied: 3, online_test: 2, interview1: 1, offer: 1 });
    expect(funnel.submittedCount).toBe(7);
    const counts = funnel.stages.map((s) => s.count) as number[];
    expect(counts).toEqual([7, 4, 2, 1]);
    const empty = buildApplicationFunnel(null);
    expect(empty.stages.every((s) => s.count === null)).toBe(true);
  });

  it("投递状态文案覆盖未登录 / 无进行中 / 有进行中", () => {
    expect(resolveApplicationStateText(null, null, "已投递")).toBe("登录后可记录投递阶段");
    expect(resolveApplicationStateText({}, 0, "已投递")).toBe("还没有投递记录 · 先去招花挑岗位");
    expect(resolveApplicationStateText({}, 2, "面试")).toBe("进行中 2 个 · 当前 面试");
  });
});

describe("准备度文案", () => {
  it("准备度分档", () => {
    expect(resolveGoalVerdict(80)).toBe("准备充分，可以直接投递");
    expect(resolveGoalVerdict(79)).toBe("接近达标，补一补短板");
    expect(resolveGoalVerdict(55)).toBe("接近达标，补一补短板");
    expect(resolveGoalVerdict(54)).toBe("还在积累，先补技能与项目");
  });

  it("简历缺几类资产：25% 一类，向下取整", () => {
    expect(countResumeMissingKinds(0)).toBe(4);
    expect(countResumeMissingKinds(26)).toBe(3);
    expect(countResumeMissingKinds(100)).toBe(0);
  });

  it("最弱维度取分数最低的那个", () => {
    const dims = [
      { key: "skill" as const, label: "专业基础", score: 80, detail: "" },
      { key: "project" as const, label: "项目经验", score: 40, detail: "" },
      { key: "resume" as const, label: "证书技能", score: 60, detail: "" },
      { key: "interview" as const, label: "面试表达", score: 100, detail: "" },
    ];
    expect(pickWeakest(dims).key).toBe("project");
  });

  it("页头副文案在有/无高匹配时不同", () => {
    expect(buildSubtitle(5, 3)).toBe("今日新增 5 条岗位 · 高匹配 3 条");
    expect(buildSubtitle(5, null)).toBe("今日新增 5 条岗位");
    expect(buildSubtitle(0, null)).toBe("今天暂无新岗位，先补齐目标方向与求职准备。");
    expect(buildSubtitle(null, null)).toBe("岗位抓取、准备度与投递进度集中在这里。");
  });
});
