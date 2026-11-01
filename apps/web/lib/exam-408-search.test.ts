import { describe, expect, it, vi } from "vitest";

import {
  EXAM_408_SEARCH_KINDS,
  SEARCH_GROUP_LIMIT,
  SEARCH_MAX_QUERY_LENGTH,
  buildExam408SearchResult,
  buildQuestionTitle,
  buildSearchSnippet,
  cleanSearchText,
  escapeLikePattern,
  flattenExam408SearchHits,
  highlightSearchText,
  isSearchQueryTooLong,
  likePattern,
  likePrefixPattern,
  normalizeSearchQuery,
  rankSearchHits,
  scoreSearchText,
  searchExam408,
  searchSubjectBareKey,
  searchSubjectTitle,
} from "./exam-408-search";

describe("normalizeSearchQuery", () => {
  it("去首尾空白、合并连续空白、剔除控制字符", () => {
    expect(normalizeSearchQuery("  死锁  ")).toBe("死锁");
    expect(normalizeSearchQuery("belady  异常")).toBe("belady 异常");
    expect(normalizeSearchQuery("死锁\u0000\u001f测试")).toBe("死锁 测试");
  });

  it("非字符串与空串返回空串", () => {
    expect(normalizeSearchQuery(null)).toBe("");
    expect(normalizeSearchQuery(undefined)).toBe("");
    expect(normalizeSearchQuery("   ")).toBe("");
  });
});

describe("isSearchQueryTooLong", () => {
  it("以清理后的长度判断上限", () => {
    expect(isSearchQueryTooLong("字".repeat(SEARCH_MAX_QUERY_LENGTH))).toBe(false);
    expect(isSearchQueryTooLong("字".repeat(SEARCH_MAX_QUERY_LENGTH + 1))).toBe(true);
    expect(isSearchQueryTooLong("  字  ")).toBe(false);
  });
});

describe("LIKE 模式", () => {
  it("转义 % _ 反斜杠，避免用户输入改变匹配语义", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
    expect(escapeLikePattern("c\\d")).toBe("c\\\\d");
  });

  it("生成包含与前缀模式", () => {
    expect(likePattern(" 死锁 ")).toBe("%死锁%");
    expect(likePrefixPattern("asl")).toBe("asl%");
  });
});

describe("highlightSearchText", () => {
  it("切出命中片段并保持大小写原文", () => {
    expect(highlightSearchText("死锁的四个必要条件", "死锁")).toEqual([
      { text: "死锁", match: true },
      { text: "的四个必要条件", match: false },
    ]);
    expect(highlightSearchText("ASL 与 asl", "asl")).toEqual([
      { text: "ASL", match: true },
      { text: " 与 ", match: false },
      { text: "asl", match: true },
    ]);
  });

  it("空查询 / 空文本 / 无命中回退整段", () => {
    expect(highlightSearchText("", "死锁")).toEqual([]);
    expect(highlightSearchText("线性表", "")).toEqual([{ text: "线性表", match: false }]);
    expect(highlightSearchText("线性表", "图")).toEqual([{ text: "线性表", match: false }]);
  });
});

describe("buildSearchSnippet", () => {
  it("短文本原样返回", () => {
    expect(buildSearchSnippet("死锁的四个必要条件", "死锁")).toBe("死锁的四个必要条件");
  });

  it("长文本以命中处为中心截取并加省略号", () => {
    const text = "前".repeat(60) + "死锁" + "后".repeat(60);
    const snippet = buildSearchSnippet(text, "死锁", 10);
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet).toContain("死锁");
    expect(snippet.length).toBeLessThan(text.length);
  });

  it("无命中时保留开头并截断", () => {
    const snippet = buildSearchSnippet("前".repeat(200), "死锁", 10);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet).not.toContain("死锁");
  });

  it("空文本返回空串", () => {
    expect(buildSearchSnippet("", "死锁")).toBe("");
  });
});

describe("cleanSearchText / buildQuestionTitle", () => {
  it("去掉图片、链接、公式与强调标记", () => {
    expect(cleanSearchText("![](/a.svg) 线性表 **L** 中，$O(n^2)$ 与 · 关系")).toBe(
      "线性表 L 中，O(n^2) 与 · 关系",
    );
    expect(cleanSearchText("\\alpha 与 \\beta")).toBe("与");
  });

  it("题干首行做标题，长题干截断，空题干退回题号", () => {
    expect(buildQuestionTitle("第一行题干\n第二行", 23)).toBe("第一行题干");
    expect(buildQuestionTitle("", 23)).toBe("第 23 题");
    expect(buildQuestionTitle("很长".repeat(60), 5).endsWith("…")).toBe(true);
  });
});

describe("scoreSearchText / rankSearchHits", () => {
  it("完全匹配 > 前缀 > 靠前子串 > 无命中", () => {
    expect(scoreSearchText("死锁", "死锁")).toBe(1000);
    expect(scoreSearchText("死锁与银行家", "死锁")).toBe(800);
    expect(scoreSearchText("进程死锁概述", "死锁")).toBeGreaterThan(0);
    expect(scoreSearchText("进程死锁概述", "死锁")).toBeLessThan(800);
    expect(scoreSearchText("进程管理", "死锁")).toBe(0);
  });

  it("标题命中优先于摘要命中，并按 limit 截断", () => {
    const hits = [
      {
        kind: "point" as const,
        key: "b",
        title: "进程管理",
        snippet: "死锁是重点",
        href: "/b",
        meta: "",
      },
      {
        kind: "point" as const,
        key: "a",
        title: "死锁",
        snippet: "",
        href: "/a",
        meta: "",
      },
    ];
    const ranked = rankSearchHits(hits, "死锁", 1);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.key).toBe("a");
  });
});

describe("searchSubjectTitle / searchSubjectBareKey", () => {
  it("兼容带前缀与裸科目 key", () => {
    expect(searchSubjectTitle("beokayy-408/operating-system")).toBe("操作系统");
    expect(searchSubjectTitle("operating-system")).toBe("操作系统");
    expect(searchSubjectTitle("unknown")).toBe("unknown");
    expect(searchSubjectBareKey("beokayy-408/data-structure")).toBe("data-structure");
  });
});

describe("buildExam408SearchResult", () => {
  const rows = {
    points: [
      {
        key: "beokayy-408/os-02-04",
        title: "死锁",
        summary: "死锁的四个必要条件与银行家算法",
        subject_key: "beokayy-408/operating-system",
        chapter_title: "进程管理",
      },
    ],
    studies: [
      {
        slug: "os-死锁-知识图谱",
        title: "死锁与银行家算法",
        subject_key: "operating-system",
        chapter: "进程管理",
      },
    ],
    cards: [
      { key: "408card/os-02-004", question: "死锁的四个必要条件？", subject_key: "operating-system", chapter: 2 },
    ],
    questions: [
      {
        key: "beokayy-408/2019-30",
        paper_year: 2019,
        question_number: 30,
        type: "choice",
        subject_key: "beokayy-408/operating-system",
        stem: "下列关于死锁的说法中，正确的是",
        body: "下列关于死锁的说法中，正确的是\n\nA. ...",
      },
    ],
  };

  it("四类分组各就各位，href/meta 符合专区路由", () => {
    const result = buildExam408SearchResult("死锁", rows);
    expect(result.query).toBe("死锁");
    expect(result.groups.map((group) => group.kind)).toEqual([...EXAM_408_SEARCH_KINDS]);
    expect(result.groups[0]?.hits[0]).toMatchObject({
      key: "beokayy-408/os-02-04",
      // 结果 key 仍是库内主键，href 用对外展示前缀
      href: "/learn/408/points/yuanabd-408/os-02-04",
      meta: "操作系统 · 进程管理",
    });
    expect(result.groups[1]?.hits[0]?.href).toBe(
      "/learn/408/study/" + encodeURIComponent("os-死锁-知识图谱"),
    );
    expect(result.groups[2]?.hits[0]?.href).toBe("/learn/408/drill?subject=operating-system");
    expect(result.groups[2]?.hits[0]?.meta).toBe("操作系统 · 第 2 章");
    expect(result.groups[3]?.hits[0]?.href).toBe("/learn/408/papers/2019");
    expect(result.groups[3]?.hits[0]?.meta).toBe("2019 年 · 第 30 题 · 选择题");
    expect(result.total).toBe(4);
  });

  it("每类最多返回 limit 条，空行数据返回空分组", () => {
    const many = {
      ...rows,
      cards: Array.from({ length: SEARCH_GROUP_LIMIT + 4 }, (_, index) => ({
        key: "408card/os-" + index,
        question: "死锁问题 " + index,
        subject_key: "operating-system",
        chapter: 2,
      })),
    };
    const result = buildExam408SearchResult("死锁", many);
    expect(result.groups.find((group) => group.kind === "card")?.hits).toHaveLength(SEARCH_GROUP_LIMIT);

    const empty = buildExam408SearchResult("死锁");
    expect(empty.total).toBe(0);
    expect(flattenExam408SearchHits(empty)).toEqual([]);
    expect(flattenExam408SearchHits(null)).toEqual([]);
  });
});

describe("searchExam408", () => {
  it("空查询不发 SQL，直接返回空结果", async () => {
    const client = { query: vi.fn() };
    const result = await searchExam408("   ", { client });
    expect(client.query).not.toHaveBeenCalled();
    expect(result.total).toBe(0);
    expect(result.groups).toHaveLength(4);
  });

  it("四类查询并行、带 ESCAPE 与 published 过滤，并映射结果", async () => {
    const client = {
      query: vi.fn(async (sql: string, _values?: unknown[]) => {
        if (sql.includes("exam_408_knowledge_points")) {
          return {
            rows: [
              {
                key: "beokayy-408/os-02-04",
                title: "死锁",
                summary: "四个必要条件",
                subject_key: "beokayy-408/operating-system",
                chapter_title: "进程管理",
              },
            ],
          };
        }
        if (sql.includes("exam_408_study_topics")) {
          return { rows: [{ slug: "os-deadlock", title: "死锁", subject_key: "operating-system", chapter: "进程管理" }] };
        }
        if (sql.includes("exam_408_cards")) {
          return { rows: [{ key: "408card/os-02-004", question: "死锁的条件？", subject_key: "operating-system", chapter: 2 }] };
        }
        return {
          rows: [
            {
              key: "beokayy-408/2021-31",
              paper_year: 2021,
              question_number: 31,
              type: "choice",
              subject_key: "beokayy-408/operating-system",
              stem: "死锁相关说法",
              body: "死锁相关说法",
            },
          ],
        };
      }),
    };

    const result = await searchExam408("死锁", { client });

    expect(client.query).toHaveBeenCalledTimes(4);
    for (const call of client.query.mock.calls) {
      const sql = String(call[0]);
      expect(sql).toContain("ILIKE");
      expect(sql).toContain("ESCAPE");
      expect(sql).toContain("status = 'published'");
      expect(call[1]).toContain("%死锁%");
    }
    expect(result.total).toBe(4);
    expect(result.groups.find((group) => group.kind === "question")?.hits[0]?.key).toBe(
      "beokayy-408/2021-31",
    );
  });

  it("查询失败向上抛错，交由 API 转 500", async () => {
    const client = { query: vi.fn(async () => Promise.reject(new Error("db down"))) };
    await expect(searchExam408("死锁", { client })).rejects.toThrow("db down");
  });
});