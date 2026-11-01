import { describe, expect, it } from "vitest";
import {
  MAP_MAX_ZOOM,
  clampMapPan,
  clampMapZoom,
  cleanMapNodeTitle,
  hitTestMapNode,
  knowledgeMapNodeRoute,
  layoutKnowledgeMap,
  mapNodeMeta,
  mapTextUnits,
  mapViewport,
  normalizeKnowledgeMap,
  normalizeKnowledgeMapNode,
  screenToMapPoint,
  wrapMapLabel,
  type Exam408KnowledgeMap,
} from "./exam-408-map";

/**
 * 408 章节知识图谱单测（v1.55）：归一化、跳转、折行、布局、缩放/平移边界。
 * 用例取自迁移 088 的真实结构（25 张图谱 / 154 节点，最多 11 节点、core 128 / ext 26）。
 */

const rawMap = {
  map: {
    key: "data-structure:绪论",
    subjectKey: "data-structure",
    chapter: "绪论",
    topicSlug: "data_structure-绪论-knowledge-map",
    nodes: [
      { slug: "data-structure-basic-ds", title: "数据结构基本概念", type: "core", desc: "", order: 1, studyKey: "k1", studySlug: "data-structure-basic-ds", importance: "must", examFrequency: 3, pointKey: "ds-01-01", counts: { cards: 2, demos: 1, questions: 5 } },
      { slug: "data-structure-intro-extension", title: "必看 · 绪论补充考点", type: "ext", desc: "补充细节", order: 0, studyKey: "k2", importance: "common", examFrequency: 0, counts: { cards: 0, demos: 0, questions: 0 } },
      { slug: "data-structure-basic-algorithm", title: "算法基本概念", type: "core", order: 2 },
    ],
  },
};

describe("normalizeKnowledgeMapNode", () => {
  it("收敛类型、补默认值，studySlug 缺省时回落到 slug", () => {
    const node = normalizeKnowledgeMapNode({ slug: "a-b", title: "📊 图表标题", type: "weird" }, 4);
    expect(node.type).toBe("core");
    expect(node.title).toBe("图表标题");
    expect(node.studySlug).toBe("a-b");
    expect(node.importance).toBe("common");
    expect(node.examFrequency).toBe(0);
    expect(node.counts).toEqual({ cards: 0, demos: 0, questions: 0 });
    expect(node.order).toBe(4);
    expect(node.pointKey).toBeNull();
  });

  it("ext 类型与富化字段原样保留", () => {
    const node = normalizeKnowledgeMapNode({ slug: "x", title: "必看 · 补充", type: "ext", order: 7, importance: "rare", examFrequency: "2", pointKey: "ds-01-01", counts: { questions: "5" } });
    expect(node.type).toBe("ext");
    expect(node.examFrequency).toBe(2);
    expect(node.pointKey).toBe("ds-01-01");
    expect(node.counts.questions).toBe(5);
  });

  it("标题去掉图标前缀与多余空白", () => {
    expect(cleanMapNodeTitle("📊 章节知识图谱")).toBe("章节知识图谱");
    expect(cleanMapNodeTitle("  必看 · 绪论补充考点  ")).toBe("必看 · 绪论补充考点");
    expect(cleanMapNodeTitle("")).toBe("");
  });
});

describe("normalizeKnowledgeMap", () => {
  it("解 map 包装、按 order 排序、无节点返回 null", () => {
    const map = normalizeKnowledgeMap(rawMap)!;
    expect(map.chapter).toBe("绪论");
    expect(map.key).toBe("data-structure:绪论");
    expect(map.topicSlug).toBe("data_structure-绪论-knowledge-map");
    expect(map.nodes.map((node) => node.slug)).toEqual([
      "data-structure-intro-extension",
      "data-structure-basic-ds",
      "data-structure-basic-algorithm",
    ]);
    expect(normalizeKnowledgeMap({ map: { nodes: [] } })).toBeNull();
    expect(normalizeKnowledgeMap(null)).toBeNull();
    expect(normalizeKnowledgeMap({})).toBeNull();
  });

  it("兼容直接传 map 对象（库里的 map 列只有 chapter + nodes）", () => {
    const map = normalizeKnowledgeMap({ chapter: "图", nodes: [{ slug: "g1", title: "图的基本概念", type: "core" }] })!;
    expect(map.chapter).toBe("图");
    expect(map.subjectKey).toBe("");
    expect(map.nodes).toHaveLength(1);
  });
});

describe("knowledgeMapNodeRoute", () => {
  const base = normalizeKnowledgeMapNode({ slug: "s", title: "T", pointKey: "ds-01-01" });

  it("有精读文章 slub 时优先跳精读阅读页", () => {
    const route = knowledgeMapNodeRoute({ ...base, studySlug: "data-structure-basic-ds" })!;
    expect(route.channel).toBe("exam-408-study-read");
    expect(route.path).toBe("/exam-408-study-read?slug=data-structure-basic-ds");
    expect(route.params).toEqual({ slug: "data-structure-basic-ds" });
  });

  it("没有精读文章时退到专区知识点", () => {
    const route = knowledgeMapNodeRoute({ ...base, studySlug: null })!;
    expect(route.channel).toBe("quiz-408-point");
    expect(route.path).toBe("/quiz/408-point?key=ds-01-01");
  });

  it("两者都没有时返回 null", () => {
    expect(knowledgeMapNodeRoute({ ...base, studySlug: null, pointKey: null })).toBeNull();
  });
});

describe("折行与文案", () => {
  it("中文按 1、西文按 0.55 折算宽度", () => {
    expect(mapTextUnits("知识图谱")).toBe(4);
    expect(mapTextUnits("Cache")).toBeCloseTo(2.75, 5);
    expect(mapTextUnits("")).toBe(0);
  });

  it("超宽折行；超过行数上限补省略号", () => {
    expect(wrapMapLabel("数据链路层的介质访问控制", 6, 3)).toEqual(["数据链路层的", "介质访问控制"]);
    const lines = wrapMapLabel("必看 · 数据链路层补充考点与常见陷阱汇总", 6, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(wrapMapLabel("", 6)).toEqual([""]);
  });

  it("节点小字：类型 + 考频，无考频时用题数或只留类型", () => {
    const node = normalizeKnowledgeMapNode({ slug: "n", title: "T", type: "core", examFrequency: 3 });
    expect(mapNodeMeta(node)).toBe("核心 · 真题 3 次");
    const byQuestions = normalizeKnowledgeMapNode({ slug: "n", title: "T", counts: { questions: 4 } });
    expect(mapNodeMeta(byQuestions)).toBe("核心 · 4 题");
    const quiet = normalizeKnowledgeMapNode({ slug: "n", title: "T", type: "ext" });
    expect(mapNodeMeta(quiet)).toBe("补充");
  });
});

describe("layoutKnowledgeMap", () => {
  const map: Exam408KnowledgeMap = normalizeKnowledgeMap(rawMap)!;
  const layout = layoutKnowledgeMap(map, { width: 340 });

  it("章节起点在最上方，节点数与图一致", () => {
    expect(layout.chapter.y).toBe(0);
    expect(layout.chapter.width).toBeLessThanOrEqual(layout.width);
    expect(layout.nodes).toHaveLength(3);
    expect(layout.height).toBeGreaterThan(layout.chapter.height);
  });

  it("主线沿竖线顺排，旁支在右侧且用虚线连接", () => {
    const cores = layout.nodes.filter((box) => box.kind === "core");
    const ext = layout.nodes.find((box) => box.kind === "ext")!;
    expect(cores).toHaveLength(2);
    expect(cores[1].y).toBeGreaterThan(cores[0].y);
    expect(cores.every((box) => box.x === layout.chapter.x)).toBe(true);
    expect(ext.x).toBeGreaterThan(cores[0].x + cores[0].width);
    const branch = layout.edges.find((edge) => edge.kind === "branch")!;
    expect(branch.dashed).toBe(true);
    expect(branch.x2).toBe(ext.x);
    expect(branch.y2).toBeCloseTo(ext.y + ext.height / 2, 5);
  });

  it("所有节点都在画布内，边数量 = 主线节点数 + 旁支数", () => {
    for (const box of [layout.chapter, ...layout.nodes]) {
      expect(box.x + box.width).toBeLessThanOrEqual(layout.width + 0.001);
      expect(box.y + box.height).toBeLessThanOrEqual(layout.height + 0.001);
    }
    const coreCount = layout.nodes.filter((box) => box.kind === "core").length;
    const extCount = layout.nodes.filter((box) => box.kind === "ext").length;
    expect(layout.edges).toHaveLength(coreCount + extCount);
  });

  it("窄屏（300）也不横向溢出", () => {
    const narrow = layoutKnowledgeMap(map, { width: 300 });
    expect(narrow.width).toBe(300);
    expect(narrow.nodes.every((box) => box.x + box.width <= narrow.width + 0.001)).toBe(true);
  });
});

describe("缩放 / 平移 / 命中", () => {
  it("缩放钳制在 1~3", () => {
    expect(clampMapZoom(0.2)).toBe(1);
    expect(clampMapZoom(99)).toBe(MAP_MAX_ZOOM);
    expect(clampMapZoom(Number.NaN)).toBe(1);
  });

  it("平移：内容不溢出时不动，溢出时按溢出量钳制", () => {
    expect(clampMapPan(40, 40, 1, 340, 700, 340, 700)).toEqual({ translateX: 0, translateY: 0 });
    expect(clampMapPan(-999, -999, 2, 340, 700, 340, 700)).toEqual({ translateX: -340, translateY: -700 });
    expect(clampMapPan(80, 80, 2, 340, 700, 340, 700)).toEqual({ translateX: 0, translateY: 0 });
  });

  it("视口：zoom=1 铺满宽度，高度取内容高度", () => {
    const view = mapViewport({ width: 340, height: 700, chapter: {} as never, nodes: [], edges: [] }, 340);
    expect(view.fitScale).toBe(1);
    expect(view.height).toBe(700);
    const scaled = mapViewport({ width: 680, height: 700, chapter: {} as never, nodes: [], edges: [] }, 340);
    expect(scaled.fitScale).toBe(0.5);
    expect(scaled.height).toBe(350);
  });

  it("逻辑坐标命中节点；屏幕坐标反解回逻辑坐标", () => {
    const map = normalizeKnowledgeMap(rawMap)!;
    const layout = layoutKnowledgeMap(map, { width: 340 });
    const first = layout.nodes[0];
    expect(hitTestMapNode(layout, first.x + 4, first.y + 4)?.node.slug).toBe(first.node.slug);
    expect(hitTestMapNode(layout, -50, -50)).toBeNull();
    expect(screenToMapPoint(120, 80, { scale: 2, translateX: 20, translateY: 40 })).toEqual({ x: 50, y: 20 });
  });
});
