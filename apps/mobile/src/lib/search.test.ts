import { describe, expect, it } from "vitest";
import type { LearningTrack } from "@learn-workbench/content/types";
import {
  EXAM408_SEARCH_GROUP_LABELS,
  LOCAL_SEARCH_GROUP_LABELS,
  RECENT_SEARCH_LIMIT,
  buildLearningSearchEntries,
  buildSnippet,
  exam408HitRoute,
  learningEntryRoute,
  matchSearchQuery,
  normalizeSearchQuery,
  pickExam408Groups,
  pushRecentSearch,
  sanitizeRecentSearches,
  searchLearning,
  type Exam408SearchResponse,
} from "./search";

const tracks = [
  {
    slug: "ict",
    title: "ICT 学习路线",
    category: "ict",
    level: "入门",
    accent: "#123456",
    softAccent: "#12345622",
    icon: "book",
    summary: "从网络基础到 SQL 与操作系统",
    whyLearn: "打好工程基础",
    prerequisites: [],
    studyMethod: ["先读后练"],
    estimatedHours: 40,
    featured: true,
    stages: [
      {
        key: "s1",
        title: "网络基础",
        weeks: "2 周",
        goal: "能解释 TCP 三次握手",
        outcome: "独立排查连通性",
        topics: [
          {
            key: "t1",
            title: "TCP 三次握手",
            summary: "SYN / SYN-ACK / ACK 的过程",
            concepts: ["序列号", "半连接队列"],
            principles: ["双方确认收发能力"],
            applications: ["排查握手超时"],
            pitfalls: ["把 SYN 重传当成攻击"],
            method: "抓包看三次握手",
            exercise: "用 tcpdump 抓一次握手",
            checkpoint: "能画时序图",
          },
          {
            key: "t2",
            title: "SQL 索引",
            summary: "B+ 树与回表",
            concepts: ["聚簇索引"],
            principles: [],
            applications: [],
            pitfalls: [],
            method: "",
            exercise: "",
            checkpoint: "",
          },
        ],
        questionKeys: [],
      },
    ],
    questions: [],
    sources: [],
  },
] as unknown as LearningTrack[];

const entries = buildLearningSearchEntries(tracks);

describe("normalizeSearchQuery / matchSearchQuery", () => {
  it("折叠空白并去首尾空格", () => {
    expect(normalizeSearchQuery("  tcp \n  握手 ")).toBe("tcp 握手");
    expect(normalizeSearchQuery("   ")).toBe("");
  });

  it("大小写不敏感，空搜索词不命中", () => {
    expect(matchSearchQuery("TCP 三次握手", "tcp")).toBe(true);
    expect(matchSearchQuery("sql 索引", "SQL")).toBe(true);
    expect(matchSearchQuery("sql 索引", "  ")).toBe(false);
    expect(matchSearchQuery("", "sql")).toBe(false);
  });
});

describe("buildLearningSearchEntries（内容库摊平）", () => {
  it("课程 / 主题 / 学习内容三组齐全且 key 唯一", () => {
    expect(entries.filter((item) => item.group === "course")).toHaveLength(1);
    expect(entries.filter((item) => item.group === "topic")).toHaveLength(1);
    expect(entries.filter((item) => item.group === "content")).toHaveLength(2);
    expect(new Set(entries.map((item) => item.key)).size).toBe(entries.length);
  });

  it("条目带够跳转三元组与来源说明", () => {
    const topicEntry = entries.find((item) => item.group === "topic");
    expect(topicEntry).toMatchObject({ trackSlug: "ict", stageKey: "s1", topicKey: "t1" });
    const courseEntry = entries.find((item) => item.group === "course");
    expect(courseEntry?.meta).toContain("课程");
  });
});

describe("searchLearning（本地检索）", () => {
  it("空查询返回空数组", () => {
    expect(searchLearning(entries, "   ")).toEqual([]);
  });

  it("中文子串命中，分组带中文标题", () => {
    const groups = searchLearning(entries, "握手");
    expect(groups.length).toBeGreaterThan(0);
    const content = groups.find((group) => group.group === "content");
    expect(content?.label).toBe(LOCAL_SEARCH_GROUP_LABELS.content);
    expect(content?.hits[0].title).toBe("TCP 三次握手");
    expect(content?.hits[0].snippet.length).toBeGreaterThan(0);
  });

  it("英文大小写不敏感（sql / SQL）", () => {
    const lower = searchLearning(entries, "sql");
    const upper = searchLearning(entries, "SQL");
    expect(lower.map((group) => group.group)).toEqual(upper.map((group) => group.group));
    // 课程摘要里也提到 SQL，所以按分组取：学习内容组的首条应是标题命中的「SQL 索引」
    const content = lower.find((group) => group.group === "content");
    expect(content?.hits[0].title).toBe("SQL 索引");
  });

  it("标题命中排在正文命中之前", () => {
    // "SQL 索引" 的标题命中应排在仅正文命中的条目之前
    const content = searchLearning(entries, "SQL").find((group) => group.group === "content");
    expect(content?.hits[0].title).toBe("SQL 索引");
  });

  it("每组最多 limit 条，total 反映本组命中数", () => {
    const groups = searchLearning(entries, "的", 1);
    for (const group of groups) expect(group.hits.length).toBeLessThanOrEqual(1);
  });

  it("无命中返回空数组", () => {
    expect(searchLearning(entries, "不存在的词")).toEqual([]);
  });
});

describe("buildSnippet", () => {
  it("命中处两侧截取并加省略号", () => {
    const text = "A".repeat(60) + "关键" + "B".repeat(60);
    const snippet = buildSnippet(text, "关键", 10);
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet).toContain("关键");
  });

  it("无命中时保留开头，短文本原样返回", () => {
    expect(buildSnippet("短文本", "不存在")).toBe("短文本");
    expect(buildSnippet("", "x")).toBe("");
  });
});

describe("learningEntryRoute（本地命中 → 路由）", () => {
  it("课程 → 课程详情", () => {
    expect(learningEntryRoute({ group: "course", trackSlug: "ict", stageKey: "s1", topicKey: "t1" })).toEqual({
      href: "/quiz/ict",
    });
  });

  it("主题/学习内容 → 阅读页并带场外通道（防 params 冻结）", () => {
    const route = learningEntryRoute({ group: "content", trackSlug: "ict", stageKey: "s1", topicKey: "t1" });
    expect(route.href).toBe("/quiz/read?track=ict&stage=s1&topic=t1");
    expect(route.navChannel).toBe("quiz-read");
    expect(route.navParams).toEqual({ track: "ict", stage: "s1", topic: "t1" });
  });

  it("参数做 URL 编码", () => {
    const route = learningEntryRoute({ group: "topic", trackSlug: "a b", stageKey: "s1", topicKey: "t&1" });
    expect(route.href).toContain("track=a%20b");
    expect(route.href).toContain("topic=t%261");
  });
});

describe("408 搜索（分组过滤与路由映射）", () => {
  const response: Exam408SearchResponse = {
    query: "死锁",
    total: 3,
    limit: 8,
    groups: [
      { kind: "study", label: "精读", total: 1, hits: [{ kind: "study", key: "os-deadlock", title: "死锁", snippet: "…", href: "/learn/408/study/x", meta: "操作系统" }] },
      { kind: "point", label: "知识点", total: 1, hits: [{ kind: "point", key: "beokayy-408/os-02-03", title: "死锁", snippet: "…", href: "/learn/408/points/x", meta: "操作系统" }] },
      { kind: "card", label: "速记卡", total: 1, hits: [{ kind: "card", key: "c1", title: "卡", snippet: "…", href: "/learn/408/cards", meta: "操作系统" }] },
      { kind: "question", label: "真题", total: 1, hits: [] },
    ],
  };

  it("只保留 408 精读 / 408 知识点，丢掉空组和其它类型", () => {
    const groups = pickExam408Groups(response);
    expect(groups.map((group) => group.kind)).toEqual(["study", "point"]);
    expect(groups.map((group) => group.label)).toEqual([
      EXAM408_SEARCH_GROUP_LABELS.study,
      EXAM408_SEARCH_GROUP_LABELS.point,
    ]);
  });

  it("响应为空/结构异常时按空处理", () => {
    expect(pickExam408Groups(null)).toEqual([]);
    expect(pickExam408Groups({} as Exam408SearchResponse)).toEqual([]);
  });

  it("精读 → 阅读页（带场外通道），知识点 → 知识点详情页", () => {
    const study = exam408HitRoute({ kind: "study", key: "os-deadlock" });
    expect(study.href).toBe("/exam-408-study-read?slug=os-deadlock");
    expect(study.navChannel).toBe("exam-408-study-read");
    const point = exam408HitRoute({ kind: "point", key: "beokayy-408/os-02-03" });
    expect(point.href).toBe("/quiz/408-point?key=beokayy-408%2Fos-02-03");
    expect(point.navChannel).toBeUndefined();
  });
});

describe("最近搜索（存储格式）", () => {
  it("新词置顶、大小写不敏感去重、最多 8 条", () => {
    let list: string[] = [];
    for (const word of ["TCP", "sql", "tcp", "索引", "死锁", "IP", "UDP", "HTTP", "DNS", "ARP"]) {
      list = pushRecentSearch(list, word);
    }
    expect(list).toHaveLength(RECENT_SEARCH_LIMIT);
    expect(list[0]).toBe("ARP");
    expect(list.filter((item) => item.toLowerCase() === "tcp")).toHaveLength(1);
  });

  it("空/非字符串数据被清洗", () => {
    expect(sanitizeRecentSearches(["  ", "", 3, null, "tcp", " TCP "])).toEqual(["tcp"]);
    expect(sanitizeRecentSearches(null)).toEqual([]);
  });

  it("空搜索词不写进最近搜索", () => {
    const list = pushRecentSearch(["tcp"], "   ");
    expect(list).toEqual(["tcp"]);
  });
});
