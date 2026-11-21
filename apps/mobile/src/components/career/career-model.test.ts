import { describe, expect, it } from "vitest";
import {
  buildApplicationFunnel,
  buildCareerFunnel,
  buildDeadlines,
  buildDecisionLog,
  buildDecisionRows,
  buildDirection,
  buildGapBars,
  buildGapSkillItems,
  buildSubtitle,
  buildWeekActions,
  countGapSkills,
  countResumeMissingKinds,
  countStages,
  formatDeadlineShort,
  pickWeakest,
  resolveApplicationStateText,
  resolveGoalVerdict,
  resolveHighMatchCount,
  resolveMatchTone,
  resolveStageIndex,
  salaryBandRatio,
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
/**
 * V7 决策工作台的新纯函数回归。
 *
 * 这一层最容易出的问题不是崩溃，而是「口径漂移」：
 * 匹配度分档、薪资条宽度、漏斗转化率一旦算错，界面看着正常但结论是错的。
 */
const radarJob = (over: Partial<RadarJobLite> = {}): RadarJobLite => ({
  jobId: 1,
  title: "前端开发工程师",
  company: "某科技",
  deadlineLabel: "21 天后截止",
  gapHours: 14,
  missingSkills: [{ skill: "Node.js" }, { skill: "K8s" }],
  city: "乌鲁木齐",
  salaryText: "8-12K",
  salaryBand: "8-12K",
  overall: 80,
  matchedSkills: [{ skill: "React" }, { skill: "TypeScript" }, { skill: "CSS" }, { skill: "Webpack" }, { skill: "Vue" }],
  ...over,
});

describe("决策工作台 · 基础口径", () => {
  it("截止文案压缩成矩阵短标签", () => {
    expect(formatDeadlineShort("21 天后截止")).toBe("21d");
    expect(formatDeadlineShort("今日截止")).toBe("今日");
    expect(formatDeadlineShort(null)).toBe("—");
    expect(formatDeadlineShort("长期招聘")).toBe("长期招聘");
  });

  it("薪资带宽度：上沿 / 16K 封顶，无数值文案为 0", () => {
    expect(salaryBandRatio("8-12K")).toBeCloseTo(0.75, 2);
    expect(salaryBandRatio("20-30K")).toBe(1);
    expect(salaryBandRatio("面议")).toBe(0);
    expect(salaryBandRatio("")).toBe(0);
  });

  it("匹配度分档：绿 ≥75 / 蓝 ≥65 / 灰 <65", () => {
    expect(resolveMatchTone(80)).toBe("hi");
    expect(resolveMatchTone(75)).toBe("hi");
    expect(resolveMatchTone(70)).toBe("mid");
    expect(resolveMatchTone(65)).toBe("mid");
    expect(resolveMatchTone(59)).toBe("lo");
  });
});

describe("目标方向卡（buildDirection）", () => {
  it("标题 = 目标岗位 · 城市；匹配度取 top 前 4 的均值；三条细进度条来自真实字段", () => {
    const radar: RadarSummary = {
      hasProfile: true,
      profileCity: "乌鲁木齐",
      targetRole: "前端",
      top: [radarJob(), radarJob({ jobId: 2, overall: 76 })],
    };
    const direction = buildDirection({ radar, readiness: null, skills: [] });
    expect(direction.title).toBe("前端 · 乌鲁木齐");
    expect(direction.hasTarget).toBe(true);
    expect(direction.fitScore).toBe(78);
    expect(direction.bars.map((bar) => bar.label)).toEqual(["技能命中", "薪资匹配", "城市一致"]);
    expect(direction.bars[0].valueLabel).toBe("5/7");
    expect(direction.bars[0].ratio).toBeCloseTo(5 / 7, 3);
    expect(direction.bars[1].valueLabel).toBe("8-12K");
    expect(direction.bars[2].valueLabel).toBe("是");
  });

  it("画像为空时：标题走兜底、匹配度为 null、三条条子都是「—」", () => {
    const direction = buildDirection({ radar: null, readiness: null, skills: [] });
    expect(direction.title).toBe("前端 / 全栈 · 乌鲁木齐");
    expect(direction.hasTarget).toBe(false);
    expect(direction.fitScore).toBeNull();
    expect(direction.bars.every((bar) => bar.valueLabel === "—")).toBe(true);
  });

  it("没有岗位技能数据时，技能命中回落到技能画像（level>=2 记为命中）", () => {
    const direction = buildDirection({
      radar: { hasProfile: true, top: [radarJob({ matchedSkills: [], missingSkills: [] })] },
      readiness: null,
      skills: [
        { id: 1, name: "React", category: "frame", level: 3, source: "manual" },
        { id: 2, name: "Vue", category: "frame", level: 2, source: "manual" },
        { id: 3, name: "Node", category: "back", level: 1, source: "manual" },
      ],
    });
    expect(direction.bars[0].valueLabel).toBe("2/3");
  });
});

describe("岗位决策矩阵（buildDecisionRows）", () => {
  it("取前 4 个岗位；匹配徽章/成长档/薪资/截止都从雷达字段派生", () => {
    const rows = buildDecisionRows([
      radarJob(),
      radarJob({ jobId: 2, title: "全栈工程师", overall: 70, missingSkills: [] }),
      radarJob({ jobId: 3, overall: 66, salaryText: "", salaryBand: "" }),
      radarJob({
        jobId: 4,
        overall: 59,
        deadlineLabel: null,
        missingSkills: [{ skill: "K8s" }, { skill: "Node.js" }, { skill: "系统设计" }],
      }),
      radarJob({ jobId: 5, overall: 40 }),
    ]);
    expect(rows).toHaveLength(4);
    expect(rows[0].matchTone).toBe("hi");
    expect(rows[0].growth).toEqual({ label: "中", tone: "mid" });
    expect(rows[0].deadline).toBe("21d");
    expect(rows[1].growth).toEqual({ label: "稳", tone: "hi" });
    expect(rows[1].matchTone).toBe("mid");
    expect(rows[2].salary).toBe("—");
    expect(rows[3].deadline).toBe("—");
    expect(rows[3].matchTone).toBe("lo");
    expect(rows[3].growth).toEqual({ label: "高", tone: "warn" });
  });
});

describe("技能缺口（buildGapBars）", () => {
  it("技能画像按等级升序取 3 条，进度 = level/3，右侧「LvN → Lv3」", () => {
    const bars = buildGapBars(
      [
        { id: 1, name: "Node.js", category: "back", level: 2, source: "manual" },
        { id: 2, name: "K8s", category: "ops", level: 0, source: "manual" },
        { id: 3, name: "系统设计", category: "base", level: 1, source: "manual" },
        { id: 4, name: "React", category: "frame", level: 3, source: "manual" },
      ],
      []
    );
    expect(bars.map((bar) => bar.label)).toEqual(["K8s", "系统设计", "Node.js"]);
    expect(bars[0].valueLabel).toBe("Lv0 → Lv3");
    expect(bars[0].ratio).toBe(0);
    expect(bars[2].ratio).toBeCloseTo(2 / 3, 3);
  });

  it("画像为空时回落到岗位雷达的 missingSkills", () => {
    const bars = buildGapBars([], ["K8s", "Node.js"]);
    expect(bars.map((bar) => bar.label)).toEqual(["K8s", "Node.js"]);
    expect(bars[0].valueLabel).toBe("Lv0 → Lv3");
  });
});

describe("投递漏斗（buildCareerFunnel）", () => {
  it("五级累计计数 + 逐级转化率，收藏/已投不算转化（避免 >100% 的假转化）", () => {
    const rows = buildCareerFunnel({ favorite: 2, applied: 3, online_test: 1, interview1: 1 });
    expect(rows.map((row) => row.label)).toEqual(["收藏", "已投", "笔试", "面试", "Offer"]);
    expect(rows.map((row) => row.count)).toEqual([2, 5, 2, 1, 0]);
    expect(rows.map((row) => row.widthPct)).toEqual([40, 100, 40, 20, 0]);
    expect(rows.map((row) => row.rateLabel)).toEqual(["—", "—", "40%", "50%", "0%"]);
  });

  it("没有投递数据时计数为 null（不能显示 0）", () => {
    const rows = buildCareerFunnel(null);
    expect(rows.every((row) => row.count === null)).toBe(true);
    expect(rows.every((row) => row.widthPct === 0 && row.rateLabel === "—")).toBe(true);
  });
});

describe("本周行动 / 决策日志", () => {
  it("本周行动 3 条，副文案尽量挂真实数据", () => {
    const actions = buildWeekActions({
      matchedCount: 7,
      deadlines: [{ key: "1", title: "前端开发工程师", company: "某科技", deadlineLabel: "21 天后截止" }],
      gapBars: [{ key: "k", label: "Node.js", level: 2, targetLevel: 3, ratio: 2 / 3, valueLabel: "Lv2 → Lv3" }],
      gapHours: 6,
      resumeScore: 75,
      hasReadiness: true,
    });
    expect(actions).toHaveLength(3);
    expect(actions[0].detail).toBe("优先 前端开发工程师（21 天后截止）");
    expect(actions[1].title).toBe("补 Node.js 到 Lv3");
    expect(actions[2].detail).toBe("当前 75% · 还缺 1 类");
  });

  it("决策日志 3 条、日期为 MM-DD，第三条用真实目标方向", () => {
    const items = buildDecisionLog(new Date("2026-11-22T10:00:00+08:00"), "前端 · 乌鲁木齐");
    expect(items).toHaveLength(3);
    expect(items[0].date).toBe("11-20");
    expect(items[1].date).toBe("11-18");
    expect(items[2].date).toBe("11-16");
    expect(items[2].highlight).toBe("前端 · 乌鲁木齐");
  });
});
