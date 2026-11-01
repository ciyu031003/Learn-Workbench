import { pgPool } from "@/lib/db";
import { studyImportanceMeta, type StudyImportance } from "@/lib/exam-408-study";

import { externalizePointKey } from "./exam-408-point-key";

/**
 * 408 章节知识图谱（迁移 088）—— cs408 精读里原本的 iframe 交互图谱，改成本地数据 + 原生 SVG 自绘。
 *
 * 数据形状（exam_408_knowledge_maps.map）：
 *   { chapter: string, nodes: [{ slug,title,type:'core'|'ext'|'viz',desc,order,studyKey,pointKey,
 *                               importance:'must'|'common'|'understand',examFrequency,counts:{cards,demos,questions} }] }
 *
 * 分工：
 *  - getExam408KnowledgeMap：只做 SQL 与字段归一（studyKey → studySlug 的解析也在这里补齐）；
 *  - layoutKnowledgeMap / wrapMapTitle / summarizeKnowledgeMap：纯函数，单测覆盖，Web 组件与 API 共用。
 *
 * 说明：节点里存的 studyKey 是 exam_408_study_topics.key（UUID），不是可读 slug；
 * 组件要的跳转地址由这里 join 出 studySlug，缺 studySlug 时退回知识点页（pointKey）。
 */

/* ------------------------------------------------------------------ */
/* 类型                                                                */
/* ------------------------------------------------------------------ */

export type Exam408MapNodeType = "core" | "ext" | "viz";

export interface Exam408MapNodeCounts {
  cards: number;
  demos: number;
  questions: number;
}

export interface Exam408MapNode {
  slug: string;
  title: string;
  type: Exam408MapNodeType;
  desc: string;
  /** 同章节内的阅读顺序（0 起） */
  order: number;
  importance: StudyImportance;
  importanceLabel: string;
  examFrequency: number;
  pointKey: string | null;
  studySlug: string | null;
  /** 点击跳转地址；没有可用目标时为 null（卡片仍展示，但不可点） */
  href: string | null;
  target: "study" | "point" | null;
  counts: Exam408MapNodeCounts;
}

export interface Exam408KnowledgeMapStats {
  nodes: number;
  core: number;
  ext: number;
  cards: number;
  demos: number;
  questions: number;
  examFrequency: number;
}

export interface Exam408KnowledgeMap {
  key: string;
  subjectKey: string;
  subjectTitle: string;
  subjectShortName: string;
  chapter: string;
  topicSlug: string | null;
  topicTitle: string | null;
  nodes: Exam408MapNode[];
  stats: Exam408KnowledgeMapStats;
}

/** 布局：章节起点 → core 节点竖向主链；ext 节点作为右侧虚线旁支。 */
export interface Exam408MapPlacement {
  node: Exam408MapNode;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  /** 主链序号（ext 为 -1） */
  index: number;
}

export interface Exam408MapLink {
  kind: "start" | "core" | "branch";
  points: Array<[number, number]>;
}

export interface Exam408MapLayout {
  width: number;
  height: number;
  start: { x: number; y: number; width: number; height: number; centerX: number; centerY: number };
  cores: Exam408MapPlacement[];
  exts: Exam408MapPlacement[];
  links: Exam408MapLink[];
}

export type Exam408KnowledgeMapQuery =
  | { topicSlug: string }
  | { subjectKey: string; chapter?: string };

/* ------------------------------------------------------------------ */
/* 布局常量（组件与测试共用，改这里即改图）                             */
/* ------------------------------------------------------------------ */

export const MAP_LAYOUT = {
  width: 800,
  startWidth: 340,
  startHeight: 52,
  startY: 20,
  coreWidth: 340,
  coreHeight: 64,
  coreGap: 28,
  coreX: 96,
  extWidth: 320,
  extHeight: 56,
  extX: 460,
  extGap: 16,
  firstNodeY: 112,
  paddingBottom: 28,
} as const;

const MAP_SPINE_X = MAP_LAYOUT.coreX + MAP_LAYOUT.coreWidth / 2;

/* ------------------------------------------------------------------ */
/* 纯函数：节点归一 / 跳转 / 统计 / 布局                                 */
/* ------------------------------------------------------------------ */

function toCount(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function toNodeType(value: unknown): Exam408MapNodeType {
  return value === "ext" || value === "viz" ? value : "core";
}

/** studyKey（UUID）→ studySlug（可读 slug）；供 enrichMapNodes 使用。 */
export type StudySlugResolver = ReadonlyMap<string, string>;

/**
 * 把库里的原始节点归一成可渲染节点：补 importance 标签、跳转地址（studySlug 优先，其次 pointKey）。
 * 原始数据缺字段时给出安全默认值，保证组件永远不会因为脏数据崩掉。
 */
export function enrichMapNodes(rawNodes: unknown, studySlugByKey: StudySlugResolver): Exam408MapNode[] {
  if (!Array.isArray(rawNodes)) return [];
  const nodes = rawNodes
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((raw, index): Exam408MapNode => {
      const meta = studyImportanceMeta(raw.importance);
      const studyKey = typeof raw.studyKey === "string" ? raw.studyKey : "";
      const rawStudySlug = typeof raw.studySlug === "string" ? raw.studySlug.trim() : "";
      const pointKey = typeof raw.pointKey === "string" && raw.pointKey.trim() ? raw.pointKey.trim() : null;
      const studySlug = rawStudySlug || (studyKey ? studySlugByKey.get(studyKey) ?? "" : "") || null;
      const counts = (raw.counts && typeof raw.counts === "object" ? raw.counts : {}) as Record<string, unknown>;
      const target: Exam408MapNode["target"] = studySlug ? "study" : pointKey ? "point" : null;
      return {
        slug: typeof raw.slug === "string" && raw.slug ? raw.slug : "node-" + index,
        title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "未命名知识点",
        type: toNodeType(raw.type),
        desc: typeof raw.desc === "string" ? raw.desc.trim() : "",
        order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index,
        importance: meta.key,
        importanceLabel: meta.label,
        examFrequency: toCount(raw.examFrequency),
        pointKey,
        studySlug,
        href:
          target === "study" && studySlug
            ? "/learn/408/study/" + encodeURIComponent(studySlug)
            : target === "point" && pointKey
              ? "/learn/408/points/" + encodeURIComponent(externalizePointKey(pointKey))
              : null,
        target,
        counts: { cards: toCount(counts.cards), demos: toCount(counts.demos), questions: toCount(counts.questions) },
      };
    });
  return nodes.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "zh-Hans-CN"));
}

export function summarizeKnowledgeMap(nodes: Exam408MapNode[]): Exam408KnowledgeMapStats {
  return nodes.reduce<Exam408KnowledgeMapStats>(
    (stats, node) => ({
      nodes: stats.nodes + 1,
      core: stats.core + (node.type === "core" ? 1 : 0),
      ext: stats.ext + (node.type === "ext" ? 1 : 0),
      cards: stats.cards + node.counts.cards,
      demos: stats.demos + node.counts.demos,
      questions: stats.questions + node.counts.questions,
      examFrequency: stats.examFrequency + node.examFrequency,
    }),
    { nodes: 0, core: 0, ext: 0, cards: 0, demos: 0, questions: 0, examFrequency: 0 },
  );
}

/** 节点类型的中文标签（core 主链 / ext 补充 / viz 演示）。 */
export function mapNodeTypeLabel(type: Exam408MapNodeType): string {
  if (type === "ext") return "补充";
  if (type === "viz") return "演示";
  return "核心";
}

/**
 * 标题折行（SVG 不能自动换行）：按「中文 1 个单位、ASCII 0.55 个单位」估算宽度，
 * 超过 maxUnits 换行，最多 maxLines 行，溢出用省略号。
 */
export function wrapMapTitle(text: string, maxUnits = 15, maxLines = 2): string[] {
  const source = String(text ?? "").trim();
  if (!source) return [""];
  const lines: string[] = [];
  let current = "";
  let currentUnits = 0;
  const flush = () => {
    if (current) lines.push(current);
    current = "";
    currentUnits = 0;
  };
  for (const char of source) {
    const units = /[\u0000-\u00ff]/.test(char) ? 0.55 : 1;
    if (currentUnits + units > maxUnits && current) flush();
    current += char;
    currentUnits += units;
    if (lines.length >= maxLines) break;
  }
  flush();
  if (lines.length > maxLines) lines.length = maxLines;
  if (lines.join("").length < source.length && lines.length === maxLines) {
    const last = lines[maxLines - 1] ?? "";
    lines[maxLines - 1] = last.slice(0, Math.max(1, last.length - 1)) + "…";
  }
  return lines.length > 0 ? lines : [""];
}

/**
 * 计算章节图谱的几何布局：
 *  - 起点卡（章节）在最上方；
 *  - core 节点沿中轴自上而下，用实线串成学习路径；
 *  - ext 节点挂在「它前面最近一个 core 节点」右侧，用正交折线（虚线）连接。
 *
 * 返回纯坐标，组件只负责把坐标画出来，因此布局可单测。
 */
export function layoutKnowledgeMap(nodes: Exam408MapNode[]): Exam408MapLayout {
  const start = {
    x: MAP_LAYOUT.coreX,
    y: MAP_LAYOUT.startY,
    width: MAP_LAYOUT.startWidth,
    height: MAP_LAYOUT.startHeight,
    centerX: MAP_SPINE_X,
    centerY: MAP_LAYOUT.startY + MAP_LAYOUT.startHeight / 2,
  };

  const sorted = [...nodes].sort((a, b) => a.order - b.order);
  const cores: Exam408MapPlacement[] = [];
  const exts: Exam408MapPlacement[] = [];
  const links: Exam408MapLink[] = [];

  let coreY = MAP_LAYOUT.firstNodeY;
  for (const node of sorted) {
    if (node.type === "ext" || node.type === "viz") continue;
    const placement: Exam408MapPlacement = {
      node,
      x: MAP_LAYOUT.coreX,
      y: coreY,
      width: MAP_LAYOUT.coreWidth,
      height: MAP_LAYOUT.coreHeight,
      centerX: MAP_LAYOUT.coreX + MAP_LAYOUT.coreWidth / 2,
      centerY: coreY + MAP_LAYOUT.coreHeight / 2,
      index: cores.length,
    };
    cores.push(placement);
    coreY += MAP_LAYOUT.coreHeight + MAP_LAYOUT.coreGap;
  }

  // 主链：起点 → core[0] → core[1] → …
  if (cores.length === 0) {
    // 没有核心节点时，把补充节点直接接在起点下面（数据异常时的兜底）
    links.push({ kind: "start", points: [[MAP_SPINE_X, start.y + start.height], [MAP_SPINE_X, MAP_LAYOUT.firstNodeY]] });
  } else {
    links.push({
      kind: "start",
      points: [
        [MAP_SPINE_X, start.y + start.height],
        [MAP_SPINE_X, (cores[0]?.y ?? MAP_LAYOUT.firstNodeY) - 8],
      ],
    });
    for (let index = 0; index < cores.length - 1; index += 1) {
      const from = cores[index] as Exam408MapPlacement;
      const to = cores[index + 1] as Exam408MapPlacement;
      links.push({
        kind: "core",
        points: [
          [MAP_SPINE_X, from.y + from.height],
          [MAP_SPINE_X, to.y - 8],
        ],
      });
    }
  }

  let extBottom = 0;
  let anchor: Exam408MapPlacement | null = null;
  let anchorCoreIndex = -1;
  for (const node of sorted) {
    if (node.type === "core") {
      anchorCoreIndex += 1;
      anchor = cores[anchorCoreIndex] ?? null;
      continue;
    }
    const reference = anchor;
    const referenceCenterY = reference ? reference.centerY : start.centerY;
    const y = Math.max(referenceCenterY - MAP_LAYOUT.extHeight / 2, extBottom + MAP_LAYOUT.extGap, MAP_LAYOUT.firstNodeY);
    const placement: Exam408MapPlacement = {
      node,
      x: MAP_LAYOUT.extX,
      y,
      width: MAP_LAYOUT.extWidth,
      height: MAP_LAYOUT.extHeight,
      centerX: MAP_LAYOUT.extX + MAP_LAYOUT.extWidth / 2,
      centerY: y + MAP_LAYOUT.extHeight / 2,
      index: -1,
    };
    exts.push(placement);
    extBottom = y + MAP_LAYOUT.extHeight;
    const fromX = reference ? reference.x + reference.width : MAP_SPINE_X;
    const elbowX = MAP_LAYOUT.extX - 18;
    links.push({
      kind: "branch",
      points: [
        [fromX, reference ? reference.centerY : start.centerY],
        [elbowX, reference ? reference.centerY : start.centerY],
        [elbowX, placement.centerY],
        [MAP_LAYOUT.extX, placement.centerY],
      ],
    });
  }

  const bottom = Math.max(
    start.y + start.height,
    cores.length > 0 ? (cores[cores.length - 1] as Exam408MapPlacement).y + MAP_LAYOUT.coreHeight : 0,
    exts.length > 0 ? (exts[exts.length - 1] as Exam408MapPlacement).y + MAP_LAYOUT.extHeight : 0,
  );

  return {
    width: MAP_LAYOUT.width,
    height: Math.max(240, bottom + MAP_LAYOUT.paddingBottom),
    start,
    cores,
    exts,
    links,
  };
}

/* ------------------------------------------------------------------ */
/* 纯函数：视窗（缩放/平移）——组件只维护一个 viewBox，逻辑放这里可单测   */
/* ------------------------------------------------------------------ */

export interface Exam408MapViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 缩放下限（viewBox 宽度）：再小就只剩一两张卡片了。 */
const MIN_VIEW_WIDTH = 240;
/** 初始视窗：以「铺满宽度、约占 0.8 个宽度的高度」为默认，纵向内容靠平移浏览。 */
export function createMapViewBox(layout: Exam408MapLayout): Exam408MapViewBox {
  return { x: 0, y: 0, w: layout.width, h: Math.min(layout.height, Math.round(layout.width * 0.8)) };
}

function clampAxis(value: number, viewSize: number, contentSize: number): number {
  const slack = viewSize * 0.15;
  const min = Math.min(0, contentSize - viewSize) - slack;
  const max = Math.max(0, contentSize - viewSize) + slack;
  return Math.min(max, Math.max(min, value));
}

/** 以 (focusX, focusY)（viewBox 坐标系）为中心缩放；factor > 1 放大。 */
export function zoomMapViewBox(
  view: Exam408MapViewBox,
  layout: Exam408MapLayout,
  factor: number,
  focusX: number,
  focusY: number,
): Exam408MapViewBox {
  const bounded = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const nextWidth = Math.min(Math.max(view.w / bounded, MIN_VIEW_WIDTH), layout.width);
  const scale = nextWidth / view.w;
  const nextHeight = view.h * scale;
  return {
    x: clampAxis(focusX - (focusX - view.x) * scale, nextWidth, layout.width),
    y: clampAxis(focusY - (focusY - view.y) * scale, nextHeight, layout.height),
    w: nextWidth,
    h: nextHeight,
  };
}

/** 平移（dx/dy 为 viewBox 坐标增量），并限制在内容附近，拖不丢。 */
export function panMapViewBox(
  view: Exam408MapViewBox,
  layout: Exam408MapLayout,
  dx: number,
  dy: number,
): Exam408MapViewBox {
  const safeDx = Number.isFinite(dx) ? dx : 0;
  const safeDy = Number.isFinite(dy) ? dy : 0;
  return {
    x: clampAxis(view.x + safeDx, view.w, layout.width),
    y: clampAxis(view.y + safeDy, view.h, layout.height),
    w: view.w,
    h: view.h,
  };
}

/** markdown 块是否是「章节知识图谱」的 iframe（其余 iframe 仍走占位卡）。 */
export function isKnowledgeMapBlock(block: { type: string; src?: string }): boolean {
  return block.type === "iframe" && typeof block.src === "string" && block.src.includes("/interactive/knowledge-map.html");
}

/* ------------------------------------------------------------------ */
/* 展示层预计算：客户端组件只收纯数据，不 import 任何服务端模块         */
/* ------------------------------------------------------------------ */

/** 节点左侧强调条的颜色类（Tailwind 的 fill-* 工具类，字符串一并序列化给客户端）。 */
export type Exam408MapAccent = "fill-primary" | "fill-warning" | "fill-accent" | "fill-muted-foreground";

export interface Exam408MapNodeVisual {
  slug: string;
  title: string;
  desc: string;
  href: string | null;
  target: "study" | "point" | null;
  type: Exam408MapNodeType;
  typeLabel: string;
  importanceLabel: string;
  examFrequency: number;
  counts: Exam408MapNodeCounts;
  /** 折行后的标题（SVG 不支持自动换行） */
  titleLines: string[];
  /** 副信息行：类型 · 重要度 · 考频 · 真题 */
  metaLine: string;
  accent: Exam408MapAccent;
}

export interface Exam408MapPresentation {
  key: string;
  subjectTitle: string;
  chapter: string;
  layout: Exam408MapLayout;
  summary: Exam408KnowledgeMapStats;
  nodes: Exam408MapNodeVisual[];
}

function accentOf(node: Exam408MapNode): Exam408MapAccent {
  if (node.type === "ext") return "fill-accent";
  if (node.importance === "must") return "fill-primary";
  if (node.importance === "common") return "fill-warning";
  return "fill-muted-foreground";
}

function metaLineOf(node: Exam408MapNode): string {
  const parts = ["[" + mapNodeTypeLabel(node.type) + "]", node.importanceLabel];
  if (node.examFrequency > 0) parts.push("考频 " + node.examFrequency);
  if (node.counts.questions > 0) parts.push("真题 " + node.counts.questions);
  if (node.counts.cards > 0) parts.push("卡片 " + node.counts.cards);
  if (node.counts.demos > 0) parts.push("演示 " + node.counts.demos);
  return parts.join(" · ");
}

/**
 * 把「归一后的图谱」预计算成可直接渲染的展示数据：
 * 布局坐标、折行标题、副信息行、强调色都在服务端算好，客户端组件只负责画与交互。
 * 这样客户端不需要 import 这个模块（模块依赖 pg），避免把数据库驱动打进浏览器包。
 */
export function buildKnowledgeMapPresentation(map: Exam408KnowledgeMap): Exam408MapPresentation {
  return {
    key: map.key,
    subjectTitle: map.subjectTitle,
    chapter: map.chapter,
    layout: layoutKnowledgeMap(map.nodes),
    summary: summarizeKnowledgeMap(map.nodes),
    nodes: map.nodes.map((node) => ({
      slug: node.slug,
      title: node.title,
      desc: node.desc,
      href: node.href,
      target: node.target,
      type: node.type,
      typeLabel: mapNodeTypeLabel(node.type),
      importanceLabel: node.importanceLabel,
      examFrequency: node.examFrequency,
      counts: node.counts,
      titleLines: wrapMapTitle(node.title, node.type === "core" ? 15 : 16, 2),
      metaLine: metaLineOf(node),
      accent: accentOf(node),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* 查询                                                                */
/* ------------------------------------------------------------------ */

interface MapRow {
  key: string;
  subject_key: string;
  chapter: string;
  topic_key: string | null;
  map: unknown;
  topic_slug: string | null;
  topic_title: string | null;
  subject_title: string | null;
  subject_short_name: string | null;
}

const MAP_SELECT = `
  m.key,
  m.subject_key,
  m.chapter,
  m.topic_key,
  m.map,
  t.slug AS topic_slug,
  t.title AS topic_title,
  s.title AS subject_title,
  s.short_name AS subject_short_name
FROM exam_408_knowledge_maps m
LEFT JOIN exam_408_study_topics t ON t.key = m.topic_key
LEFT JOIN exam_408_subjects s ON s.key = 'beokayy-408/' || m.subject_key`;

function mapNodesOf(row: MapRow): unknown {
  const payload = row.map;
  if (!payload || typeof payload !== "object") return [];
  return (payload as { nodes?: unknown }).nodes ?? [];
}

/**
 * 取章节知识图谱。
 *  - { topicSlug }：精读文章 slug → 对应章节图谱（文章页用）；
 *  - { subjectKey, chapter }：显式指定科目+章节（API 的 subject 模式用）；
 *  - { subjectKey } 不传 chapter：取该科目第一章图谱（兜底的确定性行为）。
 * 找不到时返回 null（页面/接口按 404 处理）。
 */
export async function getExam408KnowledgeMap(
  query: Exam408KnowledgeMapQuery,
): Promise<Exam408KnowledgeMap | null> {
  let result;
  if ("topicSlug" in query) {
    result = await pgPool.query<MapRow>(
      `SELECT ${MAP_SELECT} WHERE t.slug = $1 LIMIT 1`,
      [query.topicSlug],
    );
  } else if (query.chapter) {
    result = await pgPool.query<MapRow>(
      `SELECT ${MAP_SELECT} WHERE m.subject_key = $1 AND m.chapter = $2 LIMIT 1`,
      [query.subjectKey, query.chapter],
    );
  } else {
    result = await pgPool.query<MapRow>(
      `SELECT ${MAP_SELECT} WHERE m.subject_key = $1 ORDER BY m.chapter LIMIT 1`,
      [query.subjectKey],
    );
  }

  const row = result.rows[0];
  if (!row) return null;

  const rawNodes = mapNodesOf(row);
  const studyKeys = Array.isArray(rawNodes)
    ? rawNodes
        .map((node) => (node && typeof node === "object" ? (node as Record<string, unknown>).studyKey : null))
        .filter((key): key is string => typeof key === "string" && key.length > 0)
    : [];
  const studySlugByKey: StudySlugResolver =
    studyKeys.length > 0 ? await readStudySlugs(studyKeys) : new Map<string, string>();

  const nodes = enrichMapNodes(rawNodes, studySlugByKey);
  return {
    key: row.key,
    subjectKey: row.subject_key,
    subjectTitle: row.subject_title ?? row.subject_key,
    subjectShortName: row.subject_short_name ?? "",
    chapter: row.chapter,
    topicSlug: row.topic_slug,
    topicTitle: row.topic_title,
    nodes,
    stats: summarizeKnowledgeMap(nodes),
  };
}

async function readStudySlugs(keys: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(keys)];
  const { rows } = await pgPool.query<{ key: string; slug: string }>(
    `SELECT key, slug FROM exam_408_study_topics WHERE key = ANY($1::text[])`,
    [unique],
  );
  return new Map(rows.map((row) => [row.key, row.slug]));
}