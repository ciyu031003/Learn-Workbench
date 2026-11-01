import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));

import { pgPool } from "@/lib/db";
import {
  enrichMapNodes,
  getExam408KnowledgeMap,
  isKnowledgeMapBlock,
  layoutKnowledgeMap,
  MAP_LAYOUT,
  buildKnowledgeMapPresentation,
  createMapViewBox,
  panMapViewBox,
  zoomMapViewBox,
  mapNodeTypeLabel,
  summarizeKnowledgeMap,
  wrapMapTitle,
  type Exam408MapNode,
} from "./exam-408-map";

const queryMock = vi.mocked(pgPool.query);

function rawNode(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "node-a",
    title: "图的基本定义",
    type: "core",
    desc: "",
    order: 0,
    studyKey: "key-a",
    pointKey: "beokayy-408/ds-05-01",
    importance: "must",
    examFrequency: 3,
    counts: { cards: 3, demos: 1, questions: 12 },
    ...over,
  };
}

function node(over: Partial<Exam408MapNode> = {}): Exam408MapNode {
  return {
    slug: "node-a",
    title: "图的基本定义",
    type: "core",
    desc: "",
    order: 0,
    importance: "must",
    importanceLabel: "重点必读",
    examFrequency: 3,
    pointKey: "beokayy-408/ds-05-01",
    studySlug: null,
    href: null,
    target: null,
    counts: { cards: 3, demos: 1, questions: 12 },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enrichMapNodes", () => {
  it("按 order 排序，studySlug 优先、其次 studyKey 解析、最后退回 pointKey", () => {
    const nodes = enrichMapNodes(
      [
        // studyKey 解析结果为空串 → 退回知识点页
        rawNode({ slug: "c", order: 2, title: "第三", studyKey: "key-c" }),
        rawNode({ slug: "a", order: 0, studySlug: "data-structure-graph-defs" }),
        rawNode({ slug: "b", order: 1, studyKey: "key-b" }),
      ],
      new Map([["key-b", "data-structure-graph-op"], ["key-c", ""]]),
    );
    expect(nodes.map((item) => item.slug)).toEqual(["a", "b", "c"]);
    expect(nodes[0]).toMatchObject({ studySlug: "data-structure-graph-defs", target: "study" });
    expect(nodes[0]?.href).toBe("/learn/408/study/data-structure-graph-defs");
    expect(nodes[1]).toMatchObject({ studySlug: "data-structure-graph-op", target: "study" });
    expect(nodes[2]?.href).toBe("/learn/408/points/" + encodeURIComponent("yuanabd-408/ds-05-01"));
    expect(nodes[2]?.target).toBe("point");
  });

  it("重要度归一（understand → 理解为主）、counts 兜底、无目标时 href 为 null", () => {
    const [item] = enrichMapNodes([rawNode({ importance: "understand", pointKey: null, studyKey: null, counts: null })], new Map());
    expect(item).toMatchObject({
      importance: "common",
      importanceLabel: "理解为主",
      counts: { cards: 0, demos: 0, questions: 0 },
      href: null,
      target: null,
    });
  });

  it("脏数据不崩：缺 title/slug/type/order 时给安全默认值", () => {
    const nodes = enrichMapNodes([{}, { type: "unknown" }, null, "x"], new Map());
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ title: "未命名知识点", type: "core", order: 0 });
    expect(nodes[1]?.title).toBe("未命名知识点");
    expect(enrichMapNodes("not-array", new Map())).toEqual([]);
  });
});

describe("统计与文案纯函数", () => {
  it("统计节点/核心/补充/卡片/演示/真题", () => {
    const stats = summarizeKnowledgeMap([
      node({ counts: { cards: 3, demos: 1, questions: 12 }, examFrequency: 3 }),
      node({ type: "ext", counts: { cards: 2, demos: 0, questions: 4 }, examFrequency: 1 }),
      node({ type: "viz", counts: { cards: 0, demos: 2, questions: 0 }, examFrequency: 0 }),
    ]);
    expect(stats).toEqual({ nodes: 3, core: 1, ext: 1, cards: 5, demos: 3, questions: 16, examFrequency: 4 });
  });

  it("节点类型标签与标题折行（中文按 1 单位、ASCII 按 0.55 单位）", () => {
    expect(mapNodeTypeLabel("core")).toBe("核心");
    expect(mapNodeTypeLabel("ext")).toBe("补充");
    expect(mapNodeTypeLabel("viz")).toBe("演示");
    expect(wrapMapTitle("图的基本定义")).toEqual(["图的基本定义"]);
    expect(wrapMapTitle("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 10, 2)).toHaveLength(2);
    const two = wrapMapTitle("一二三四五六七八九十一二三四五六七八", 8, 2);
    expect(two).toHaveLength(2);
    expect(two[1]?.endsWith("…")).toBe(true);
    expect(wrapMapTitle("", 8)).toEqual([""]);
  });
});

describe("layoutKnowledgeMap", () => {
  it("起点在最上、core 沿中轴依次下移、ext 挂在最近 core 右侧", () => {
    const layout = layoutKnowledgeMap([
      node({ slug: "core-0", order: 0 }),
      node({ slug: "ext-0", type: "ext", order: 1 }),
      node({ slug: "core-1", order: 2 }),
      node({ slug: "ext-1", type: "ext", order: 3 }),
    ]);
    expect(layout.start.x).toBe(MAP_LAYOUT.coreX);
    expect(layout.cores.map((item) => item.node.slug)).toEqual(["core-0", "core-1"]);
    expect(layout.exts.map((item) => item.node.slug)).toEqual(["ext-0", "ext-1"]);
    expect(layout.cores[0]!.y).toBe(MAP_LAYOUT.firstNodeY);
    expect(layout.cores[1]!.y).toBeGreaterThan(layout.cores[0]!.y);
    expect(layout.exts[0]!.x).toBe(MAP_LAYOUT.extX);
    expect(layout.exts[0]!.centerY).toBe(layout.cores[0]!.centerY);
    expect(layout.links.map((link) => link.kind)).toEqual(["start", "core", "branch", "branch"]);
    expect(layout.links.find((link) => link.kind === "branch")!.points).toHaveLength(4);
    expect(layout.height).toBeGreaterThan(layout.exts[1]!.y);
    expect(layout.width).toBe(MAP_LAYOUT.width);
  });

  it("没有 core 时把补充节点接在起点下方（兜底不重叠）", () => {
    const layout = layoutKnowledgeMap([node({ slug: "ext-only", type: "ext", order: 0 })]);
    expect(layout.cores).toHaveLength(0);
    expect(layout.exts).toHaveLength(1);
    expect(layout.links).toHaveLength(2);
    expect(layout.exts[0]!.y).toBeGreaterThanOrEqual(MAP_LAYOUT.firstNodeY);
    expect(layout.height).toBeGreaterThanOrEqual(240);
  });

  it("多个补充节点按顺序纵向排布不重叠", () => {
    const layout = layoutKnowledgeMap([
      node({ slug: "core-0", order: 0 }),
      node({ slug: "ext-0", type: "ext", order: 1 }),
      node({ slug: "ext-1", type: "ext", order: 2 }),
      node({ slug: "ext-2", type: "ext", order: 3 }),
    ]);
    for (let index = 1; index < layout.exts.length; index += 1) {
      expect(layout.exts[index]!.y).toBeGreaterThanOrEqual(layout.exts[index - 1]!.y + MAP_LAYOUT.extHeight);
    }
  });
});

describe("buildKnowledgeMapPresentation（客户端只收纯数据）", () => {
  it("预计算布局/统计/标题折行/副信息行/强调色", () => {
    const nodes = enrichMapNodes(
      [
        rawNode({ slug: "a", order: 0, title: "图的基本定义", importance: "must", examFrequency: 2, studyKey: null, studySlug: "data-structure-graph-defs" }),
        rawNode({
          slug: "b",
          order: 1,
          title: "必看 · 图补充考点",
          type: "ext",
          importance: "understand",
          counts: { cards: 2, demos: 0, questions: 4 },
        }),
      ],
      new Map(),
    );
    const map = {
      key: "data-structure:图",
      subjectKey: "data-structure",
      subjectTitle: "数据结构",
      subjectShortName: "DS",
      chapter: "图",
      topicSlug: null,
      topicTitle: null,
      nodes,
      stats: summarizeKnowledgeMap(nodes),
    };
    const view = buildKnowledgeMapPresentation(map);
    expect(view).toMatchObject({ key: "data-structure:图", chapter: "图", subjectTitle: "数据结构" });
    expect(view.layout.cores).toHaveLength(1);
    expect(view.layout.exts).toHaveLength(1);
    expect(view.summary).toMatchObject({ nodes: 2, core: 1, ext: 1, cards: 5, questions: 16 });
    expect(view.nodes[0]).toMatchObject({
      titleLines: ["图的基本定义"],
      accent: "fill-primary",
      typeLabel: "核心",
      href: "/learn/408/study/data-structure-graph-defs",
    });
    expect(view.nodes[0]?.metaLine).toContain("考频 2");
    expect(view.nodes[1]).toMatchObject({ accent: "fill-accent", typeLabel: "补充" });
    expect(view.nodes[1]?.metaLine).toContain("真题 4");
  });
});

describe("视窗缩放/平移", () => {
  const layout = layoutKnowledgeMap([
    node({ slug: "core-0", order: 0 }),
    node({ slug: "core-1", order: 1 }),
    node({ slug: "core-2", order: 2 }),
  ]);

  it("初始视窗铺满宽度，高度不超过 0.8 个宽度", () => {
    const view = createMapViewBox(layout);
    expect(view.x).toBe(0);
    expect(view.y).toBe(0);
    expect(view.w).toBe(layout.width);
    expect(view.h).toBeLessThanOrEqual(Math.round(layout.width * 0.8));
  });

  it("放大时宽度变小、焦点保持不动，且不会超出最小宽度", () => {
    const view = createMapViewBox(layout);
    const zoomed = zoomMapViewBox(view, layout, 2, 400, 300);
    expect(zoomed.w).toBeLessThan(view.w);
    expect(zoomed.h).toBeLessThan(view.h);
    const tiny = zoomMapViewBox(zoomed, layout, 100, 400, 300);
    expect(tiny.w).toBe(240);
    expect(zoomMapViewBox(view, layout, Number.NaN, 0, 0).w).toBe(view.w);
  });

  it("缩小不会超过整图宽度，平移被限制在内容附近", () => {
    const view = zoomMapViewBox(createMapViewBox(layout), layout, 2, 400, 300);
    const out = zoomMapViewBox(view, layout, 0.01, 400, 300);
    expect(out.w).toBe(layout.width);
    const panned = panMapViewBox(view, layout, -10000, -10000);
    expect(panned.x).toBeGreaterThanOrEqual(-view.w);
    expect(panned.y).toBeGreaterThanOrEqual(-view.h);
    const back = panMapViewBox(view, layout, 10000, 10000);
    expect(back.x).toBeLessThanOrEqual(layout.width);
    expect(panMapViewBox(view, layout, Number.NaN, Number.NaN)).toEqual(view);
  });
});

describe("isKnowledgeMapBlock", () => {
  it("只把知识图谱 iframe 认定为可自绘，其它 iframe/块不认", () => {
    expect(isKnowledgeMapBlock({ type: "iframe", src: "/interactive/knowledge-map.html?data=x" })).toBe(true);
    expect(isKnowledgeMapBlock({ type: "iframe", src: "/interactive/demo.html?x=1" })).toBe(false);
    expect(isKnowledgeMapBlock({ type: "paragraph" })).toBe(false);
    expect(isKnowledgeMapBlock({ type: "iframe" })).toBe(false);
  });
});

describe("getExam408KnowledgeMap（pgPool mock）", () => {
  const mapRow = {
    key: "data-structure:图",
    subject_key: "data-structure",
    chapter: "图",
    topic_key: "topic-key",
    map: {
      chapter: "图",
      nodes: [
        rawNode({ slug: "a", order: 0, title: "图的基本定义", studyKey: "key-a" }),
        rawNode({ slug: "b", order: 1, title: "关键路径", type: "ext", studyKey: "key-b" }),
      ],
    },
    topic_slug: "data-structure-图-knowledge-map",
    topic_title: "📊 章节知识图谱",
    subject_title: "数据结构",
    subject_short_name: "DS",
  };

  function mock(mapRows: unknown[], slugRows: unknown[] = [{ key: "key-a", slug: "data-structure-graph-defs" }]) {
    queryMock.mockImplementation((async (sql: string) => {
      if (sql.includes("FROM exam_408_study_topics")) return { rows: slugRows } as never;
      return { rows: mapRows } as never;
    }) as never);
  }

  it("按精读文章 slug 取章节图谱，并解析 studySlug", async () => {
    mock([mapRow]);
    const map = await getExam408KnowledgeMap({ topicSlug: "data-structure-图-knowledge-map" });
    expect(map).not.toBeNull();
    expect(map).toMatchObject({
      key: "data-structure:图",
      chapter: "图",
      subjectTitle: "数据结构",
      subjectShortName: "DS",
      topicSlug: "data-structure-图-knowledge-map",
    });
    expect(map!.nodes[0]).toMatchObject({
      title: "图的基本定义",
      studySlug: "data-structure-graph-defs",
      href: "/learn/408/study/data-structure-graph-defs",
    });
    // 第二个节点 studyKey 未解析到 slug → 回落知识点页
    expect(map!.nodes[1]?.target).toBe("point");
    expect(map!.stats).toMatchObject({ nodes: 2, core: 1, ext: 1 });
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("按 subject+chapter 查询；没有 studyKey 时只查一次库", async () => {
    mock([{ ...mapRow, map: { nodes: [rawNode({ studyKey: null, studySlug: "data-structure-graph-defs" })] } }]);
    const map = await getExam408KnowledgeMap({ subjectKey: "data-structure", chapter: "图" });
    expect(map?.nodes[0]?.studySlug).toBe("data-structure-graph-defs");
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("subject 不传 chapter 时取该科目第一章图谱", async () => {
    mock([mapRow]);
    await getExam408KnowledgeMap({ subjectKey: "data-structure" });
    const sql = String(queryMock.mock.calls[0]?.[0] ?? "");
    expect(sql).toContain("ORDER BY m.chapter");
  });

  it("查不到返回 null；map 为空对象时返回空节点与零统计", async () => {
    mock([]);
    await expect(getExam408KnowledgeMap({ topicSlug: "missing" })).resolves.toBeNull();
    mock([{ ...mapRow, map: null, subject_title: null, subject_short_name: null }]);
    const empty = await getExam408KnowledgeMap({ subjectKey: "data-structure" });
    expect(empty).toMatchObject({
      nodes: [],
      stats: { nodes: 0, cards: 0, demos: 0, questions: 0 },
      subjectTitle: "data-structure",
      subjectShortName: "",
    });
  });
});