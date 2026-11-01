import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));

import { pgPool } from "@/lib/db";
import {
  buildStudyOverview,
  decodeStudySlug,
  compareStudyTopics,
  estimateStudyReadingMinutes,
  estimateStudySourceReadingMinutes,
  findStudyNeighbors,
  getExam408StudyOverview,
  getExam408StudySubject,
  getExam408StudyTopic,
  isLocalStudyImage,
  mapStudyTopicSummary,
  normalizeStudyImportance,
  normalizeStudySubjectKey,
  parseStudyMarkdown,
  studyExcerpt,
  studyHeadingId,
  studyImportanceMeta,
  studyTopicHref,
  type StudySubjectRow,
  type StudyTopicRow,
} from "./exam-408-study";

const queryMock = vi.mocked(pgPool.query);

const sourceRow = {
  key: "cs408-cloud",
  name: "408 知识库 · 知识精读",
  base_url: "https://cs408.cloud/",
  license_note: "作者已同意个人学习、非商业用途；保留署名与原文链接。",
  captured_at: new Date("2026-11-01T00:00:00.000Z"),
};

const subjectRows: StudySubjectRow[] = [
  { key: "beokayy-408/data-structure", title: "数据结构", short_name: "DS", sort_order: 0 },
  { key: "beokayy-408/computer-organization", title: "计算机组成原理", short_name: "CO", sort_order: 1 },
];

function topicRow(over: Partial<StudyTopicRow> = {}): StudyTopicRow {
  return {
    subject_key: "data-structure",
    chapter: "绪论",
    chapter_order: 1010,
    sort_order: 1,
    slug: "data_structure-绪论-basic",
    title: "数据结构基本概念",
    importance: "must",
    exam_frequency: 3,
    knowledge_point_key: "beokayy-408/ds-01-01",
    content_chars: 900,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseStudyMarkdown", () => {
  it("解析标题并生成目录（1 级标题不进目录、锚点唯一）", () => {
    const parsed = parseStudyMarkdown(["# 标题", "## 线性表 Linear List", "### 顺序存储", "## 线性表 Linear List"].join("\n"));
    const headings = parsed.blocks.filter((block) => block.type === "heading");
    expect(headings).toHaveLength(4);
    expect(headings[0]).toMatchObject({ level: 1, text: "标题" });
    expect(headings[1]).toMatchObject({ level: 2, text: "线性表 Linear List" });
    expect(parsed.toc.map((item) => item.level)).toEqual([2, 3, 2]);
    const ids = headings.map((block) => (block.type === "heading" ? block.id : ""));
    expect(new Set(ids).size).toBe(4);
    expect(ids[1]).toBe("h-linear-list-1");
    expect(ids[0]).toBe("h-sec-0");
  });

  it("段落保留手工换行与 br，行内双美元公式降级成单美元", () => {
    const parsed = parseStudyMarkdown("第一行<br>第二行\n\n公式 $$a+b$$ 在这里");
    expect(parsed.blocks[0]).toEqual({ type: "paragraph", lines: ["第一行", "第二行"] });
    expect(parsed.blocks[1]).toEqual({ type: "paragraph", lines: ["公式 $a+b$ 在这里"] });
  });

  it("解析有序/无序列表并记录两层缩进", () => {
    const parsed = parseStudyMarkdown(["1. 先建堆", "2. 再排序", "   * 子步骤 A", "- 另一组"].join("\n"));
    expect(parsed.blocks[0]).toMatchObject({ type: "list", ordered: true });
    // 有序项与无序项分属两个列表块；缩进的无序子项与其父列表同为无序，合并到一块
    expect(parsed.blocks[0]).toMatchObject({
      items: [
        { text: "先建堆", depth: 0 },
        { text: "再排序", depth: 0 },
      ],
    });
    expect(parsed.blocks[1]).toMatchObject({
      type: "list",
      ordered: false,
      items: [
        { text: "子步骤 A", depth: 1 },
        { text: "另一组", depth: 0 },
      ],
    });
  });

  it("解析表格：首行为表头、分隔行读对齐、支持转义竖线", () => {
    const parsed = parseStudyMarkdown(
      ["| 结构 | 查找 | 插入 |", "| :--- | :---: | ---: |", "| 顺序表 | O(1) | O(n) |", "| 链表 a\\|b | O(n) | O(1) |"].join("\n"),
    );
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0]).toMatchObject({
      type: "table",
      header: ["结构", "查找", "插入"],
      rows: [
        ["顺序表", "O(1)", "O(n)"],
        ["链表 a|b", "O(n)", "O(1)"],
      ],
      align: ["left", "center", "right"],
    });
  });

  it("围栏代码块支持反引号与波浪线、未闭合时吞到结尾", () => {
    const parsed = parseStudyMarkdown(
      ["```c", "int main() { return 0; }", "```", "~~~", "raw", "~~~"].join("\n"),
    );
    expect(parsed.blocks[0]).toEqual({ type: "code", lang: "c", code: "int main() { return 0; }" });
    expect(parsed.blocks[1]).toEqual({ type: "code", lang: "", code: "raw" });
    const unclosed = parseStudyMarkdown(["```", "no close"].join("\n"));
    expect(unclosed.blocks[0]).toMatchObject({ type: "code", code: "no close" });
  });

  it("解析引用提示块、分隔线、图片与 iframe 占位", () => {
    const parsed = parseStudyMarkdown(
      [
        "> 考点：可能考填写运行结果",
        "> 第二行",
        "",
        "---",
        "",
        "![AVL 旋转](/content-images/cs408/data-structure-avl.svg)",
        "",
        '<iframe src="/interactive/knowledge-map.html?x=1" width="100%" height="480" title="绪论 知识图谱"></iframe>',
      ].join("\n"),
    );
    expect(parsed.blocks[0]).toEqual({ type: "quote", lines: ["考点：可能考填写运行结果", "第二行"] });
    expect(parsed.blocks[1]).toEqual({ type: "divider" });
    expect(parsed.blocks[2]).toEqual({
      type: "image",
      alt: "AVL 旋转",
      src: "/content-images/cs408/data-structure-avl.svg",
    });
    expect(parsed.blocks[3]).toEqual({
      type: "iframe",
      src: "/interactive/knowledge-map.html?x=1",
      title: "绪论 知识图谱",
    });
  });

  it("解析 html img 标签与公式块（单行/多行）", () => {
    const parsed = parseStudyMarkdown(
      [
        '<img src="/book-figs/os/swap.png" alt="换页" />',
        "",
        "$$ E = mc^2 $$",
        "",
        "$$",
        "T(n) = 2T(n/2) + n",
        "$$",
      ].join("\n"),
    );
    expect(parsed.blocks[0]).toEqual({ type: "image", alt: "换页", src: "/book-figs/os/swap.png" });
    expect(parsed.blocks[1]).toEqual({ type: "math", tex: "E = mc^2" });
    expect(parsed.blocks[2]).toEqual({ type: "math", tex: "T(n) = 2T(n/2) + n" });
  });

  it("空正文返回空块与最小阅读时长，CRLF 归一", () => {
    expect(parseStudyMarkdown("  \r\n\r\n").blocks).toEqual([]);
    expect(parseStudyMarkdown("").stats.readingMinutes).toBe(1);
    const parsed = parseStudyMarkdown("## 标题\r\n正文");
    expect(parsed.blocks[1]).toEqual({ type: "paragraph", lines: ["正文"] });
  });

  it("统计图片/表格/代码/公式/提示块数量", () => {
    const parsed = parseStudyMarkdown(
      [
        "## 标题",
        "",
        "![图](/x.svg)",
        "",
        "| a | b |",
        "| --- | --- |",
        "| 1 | 2 |",
        "",
        "```",
        "code",
        "```",
        "",
        "$$x$$",
        "",
        "> 提示",
      ].join("\n"),
    );
    expect(parsed.stats).toMatchObject({ headings: 1, images: 1, tables: 1, codeBlocks: 1, mathBlocks: 1, callouts: 1 });
    expect(parsed.stats.readingMinutes).toBeGreaterThanOrEqual(1);
  });
});

describe("知识树纯函数", () => {
  it("科目按库排序、章节按序号、文章按 sort_order，缺正文的科目保留 0 篇", () => {
    const topics = [
      topicRow({ slug: "b", chapter: "线性表", chapter_order: 1030, sort_order: 2, content_chars: 900 }),
      topicRow({ slug: "a", chapter: "绪论", chapter_order: 1010, sort_order: 1, content_chars: 1800 }),
      topicRow({ slug: "c", chapter: "线性表", chapter_order: 1020, sort_order: 1, title: "顺序表", content_chars: 450 }),
    ];
    const overview = buildStudyOverview(topics, subjectRows);
    expect(overview.subjects.map((subject) => subject.key)).toEqual([
      "data-structure",
      "computer-organization",
      "operating-system",
      "computer-network",
    ]);
    expect(overview.subjects[0]?.chapters.map((chapter) => chapter.chapter)).toEqual(["绪论", "线性表"]);
    expect(overview.subjects[0]?.chapters[1]?.topics.map((topic) => topic.slug)).toEqual(["c", "b"]);
    // 列表阅读时长按 content_md 字符数/1129 向上取整：900→1、1800→2、450→1
    expect(overview.subjects[0]).toMatchObject({ chapterCount: 2, topicCount: 3, readingMinutes: 1 + 2 + 1 });
    expect(overview.subjects[1]).toMatchObject({ chapterCount: 0, topicCount: 0, readingMinutes: 0 });
    expect(overview.stats).toEqual({ subjects: 1, chapters: 2, topics: 3, readingMinutes: 4 });
  });

  it("文章摘要字段：重要度归一、阅读时长、知识点关联", () => {
    expect(mapStudyTopicSummary(topicRow({ importance: "understand" }))).toMatchObject({
      importance: "common",
      importanceLabel: "理解为主",
      readingMinutes: 1,
      knowledgePointKey: "beokayy-408/ds-01-01",
    });
    expect(mapStudyTopicSummary(topicRow({ importance: "???", content_chars: 0 }))).toMatchObject({
      importance: "common",
      readingMinutes: 1,
    });
    expect(
      compareStudyTopics(
        mapStudyTopicSummary(topicRow({ chapter_order: 1, sort_order: 2 })),
        mapStudyTopicSummary(topicRow({ chapter_order: 1, sort_order: 1 })),
      ),
    ).toBeGreaterThan(0);
  });

  it("上一节/下一节按同科目阅读链计算，边界与缺失返回 null", () => {
    const topics = [
      mapStudyTopicSummary(topicRow({ slug: "a", chapter_order: 1, sort_order: 1 })),
      mapStudyTopicSummary(topicRow({ slug: "b", chapter_order: 1, sort_order: 2 })),
      mapStudyTopicSummary(topicRow({ slug: "c", chapter_order: 2, sort_order: 1 })),
    ];
    expect(findStudyNeighbors(topics, "a")).toEqual({
      prev: null,
      next: { slug: "b", title: topics[1]!.title, chapter: "绪论" },
    });
    expect(findStudyNeighbors(topics, "c").next).toBeNull();
    expect(findStudyNeighbors(topics, "missing")).toEqual({ prev: null, next: null });
  });

  it("首段摘要跳过标题与图片，超长截断", () => {
    const blocks = parseStudyMarkdown(["## 标题", "![图](/x.svg)", "", "这一段是正文。", "", "第二段"].join("\n")).blocks;
    expect(studyExcerpt(blocks)).toBe("这一段是正文。");
    expect(studyExcerpt(parseStudyMarkdown("正文很长".repeat(60)).blocks, 10)).toHaveLength(11);
    expect(studyExcerpt([])).toBe("");
  });

  it("重要度/标题锚点/路由/时长/科目 key 等工具函数", () => {
    expect(normalizeStudyImportance("MUST")).toBe("must");
    expect(normalizeStudyImportance(undefined)).toBe("common");
    expect(studyImportanceMeta("rare")).toMatchObject({ label: "低频", tone: "muted" });
    expect(studyImportanceMeta("unknown").label).toBe("常考");
    expect(estimateStudyReadingMinutes(0)).toBe(1);
    expect(estimateStudyReadingMinutes(900)).toBe(2);
    expect(estimateStudyReadingMinutes(Number.NaN)).toBe(1);
    expect(estimateStudySourceReadingMinutes(0)).toBe(1);
    expect(estimateStudySourceReadingMinutes(1129)).toBe(1);
    expect(estimateStudySourceReadingMinutes(2258)).toBe(2);
    expect(estimateStudySourceReadingMinutes(Number.NaN)).toBe(1);
    expect(studyTopicHref("数据结构 绪论")).toBe("/learn/408/study/" + encodeURIComponent("数据结构 绪论"));
    expect(isLocalStudyImage("/content-images/cs408/a.svg")).toBe(true);
    expect(isLocalStudyImage("https://example.com/a.svg")).toBe(false);
    expect(isLocalStudyImage("//cdn.example.com/a.svg")).toBe(false);
    expect(normalizeStudySubjectKey("beokayy-408/data-structure")).toBe("data-structure");
    expect(normalizeStudySubjectKey("data-structure")).toBe("data-structure");
    expect(studyHeadingId("", 7)).toBe("h-sec-7");
    expect(decodeStudySlug("data_structure-%E7%BB%AA%E8%AE%BA-map")).toBe("data_structure-绪论-map");
    expect(decodeStudySlug("data_structure-绪论-map")).toBe("data_structure-绪论-map");
    expect(decodeStudySlug("%E0%A4%A")).toBe("%E0%A4%A");
  });
});

describe("查询（pgPool mock）", () => {
  function mockQueries(handlers: { source?: unknown; subjects?: unknown; topics?: unknown; topic?: unknown }) {
    queryMock.mockImplementation((async (sql: string) => {
      if (sql.includes("exam_408_source_snapshots")) return { rows: handlers.source ?? [sourceRow] } as never;
      if (sql.includes("exam_408_subjects")) return { rows: handlers.subjects ?? subjectRows } as never;
      if (sql.includes("WHERE t.slug")) return { rows: handlers.topic ?? [] } as never;
      if (sql.includes("exam_408_study_topics")) return { rows: handlers.topics ?? [] } as never;
      return { rows: [] } as never;
    }) as never);
  }

  it("getExam408StudyOverview 组装来源、科目与统计", async () => {
    mockQueries({ topics: [topicRow()] });
    const overview = await getExam408StudyOverview();
    expect(overview.source).toMatchObject({ key: "cs408-cloud", baseUrl: "https://cs408.cloud/" });
    expect(overview.stats).toEqual({ subjects: 1, chapters: 1, topics: 1, readingMinutes: 1 });
    expect(overview.subjects[0]?.chapters[0]?.topics[0]).toMatchObject({
      title: "数据结构基本概念",
      importanceLabel: "重点必读",
      examFrequency: 3,
    });
  });

  it("来源快照缺失时抛错（迁移未跑的环境要显式失败，不吞成空页）", async () => {
    mockQueries({ source: [] });
    await expect(getExam408StudyOverview()).rejects.toThrow("408 study source snapshot is missing.");
  });

  it("getExam408StudySubject 没有正文时返回 null", async () => {
    mockQueries({ topics: [] });
    await expect(getExam408StudySubject("computer-network")).resolves.toBeNull();
  });

  it("getExam408StudyTopic 返回正文块、目录与上一节/下一节", async () => {
    const content = [
      "# 数据结构基本概念",
      "",
      "正文第一段",
      "",
      "## 存储结构",
      "",
      "| 结构 | 特点 |",
      "| --- | --- |",
      "| 顺序表 | 连续 |",
    ].join("\n");
    const current = {
      ...topicRow({ slug: "b", sort_order: 2 }),
      content_md: content,
      tags: ["408", "绪论", 42],
      source_url: "https://cs408.cloud/study?topic=b",
    };
    mockQueries({
      topics: [
        topicRow({ slug: "a", sort_order: 1, title: "上篇" }),
        topicRow({ slug: "b", sort_order: 2, title: "本篇" }),
        topicRow({ slug: "c", sort_order: 3, title: "下篇" }),
      ],
      topic: [current],
    });
    const detail = await getExam408StudyTopic("b");
    expect(detail).not.toBeNull();
    expect(detail?.topic).toMatchObject({
      slug: "b",
      tags: ["408", "绪论"],
      sourceUrl: "https://cs408.cloud/study?topic=b",
      readingMinutes: 1,
    });
    expect(detail?.subject).toMatchObject({ key: "data-structure", title: "数据结构", shortName: "DS" });
    expect(detail?.blocks.some((block) => block.type === "table")).toBe(true);
    expect(detail?.toc).toEqual([{ id: "h-sec-1", text: "存储结构", level: 2 }]);
    expect(detail?.prev?.slug).toBe("a");
    expect(detail?.next?.slug).toBe("c");
    expect(detail?.excerpt).toBe("正文第一段");
  });

  it("getExam408StudyTopic 找不到 slug 时返回 null 且不再查兄弟文章", async () => {
    mockQueries({ topic: [] });
    await expect(getExam408StudyTopic("missing")).resolves.toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(2);
  });
});
