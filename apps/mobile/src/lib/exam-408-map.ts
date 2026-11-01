/**
 * 408 章节知识图谱数据层（v1.55）：远程契约 + 归一化 + 布局 + 交互纯函数。
 *
 * 背景：精读里的「📊 章节知识图谱」原本是 cs408 的 iframe（/interactive/knowledge-map.html），
 * App 里只能显示占位 + 外链。迁移 088 已把 25 张图谱（154 节点）入库并富化，
 * 双端改为原生 SVG 自绘；这里只做「数据 → 坐标」，所有几何都能单测。
 *
 * 分层：
 *   normalize*  —— 把接口/库里的松散 JSON 归一成强类型（字段缺省、排序、类型收敛）
 *   layout*     —— 章节起点 + core 顺序链 + ext 虚线旁支的坐标（逻辑单位，与像素无关）
 *   wrap*       —— SVG 没有自动换行，标题按「中文 1、西文 0.55」折算宽度手动折行
 *   clamp*      —— 缩放/平移边界（配合 PanResponder，避免把图画拖出视口）
 */

export interface Exam408MapNodeCounts {
  cards: number;
  demos: number;
  questions: number;
}

export interface Exam408KnowledgeMapNode {
  slug: string;
  title: string;
  /** core = 本章主线知识点；ext = 正文之外的补充/旁支 */
  type: "core" | "ext";
  desc: string;
  order: number;
  studyKey: string | null;
  /** 精读文章 slug（缺省时用节点 slug，二者在 cs408 里一致） */
  studySlug: string | null;
  importance: string;
  examFrequency: number;
  pointKey: string | null;
  counts: Exam408MapNodeCounts;
}

export interface Exam408KnowledgeMap {
  key: string;
  subjectKey: string;
  chapter: string;
  topicSlug: string;
  nodes: Exam408KnowledgeMapNode[];
}

/** 图谱里一个节点的几何信息（逻辑单位，渲染时整体乘以缩放） */
export interface MapNodeBox {
  node: Exam408KnowledgeMapNode;
  /** 归一化后的节点角色：章节起点 / 主线 / 旁支 */
  kind: "chapter" | "core" | "ext";
  x: number;
  y: number;
  width: number;
  height: number;
  /** 已折行的标题（SVG 里逐行 TSpan 渲染） */
  lines: string[];
  /** 第二行小字：类型 + 考频 */
  meta: string;
}

export interface MapEdge {
  kind: "spine" | "branch";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed: boolean;
}

export interface MapLayout {
  width: number;
  height: number;
  chapter: MapNodeBox;
  nodes: MapNodeBox[];
  edges: MapEdge[];
}

export interface MapViewport {
  /** 逻辑宽 → 视口宽的缩放比（zoom = 1 时正好铺满宽度） */
  fitScale: number;
  /** 视口高度（像素）：按 zoom=1 的内容高度取整，缩放后内容溢出由平移解决 */
  height: number;
}

export interface MapTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export const MAP_CANVAS_WIDTH = 520;
export const MAP_PADDING = 12;
export const MAP_COLUMN_GUTTER = 16;
export const MAP_MIN_ZOOM = 1;
export const MAP_MAX_ZOOM = 3;
export const MAP_MIN_WIDTH = 300;

const SPINE_TITLE_FONT = 13;
const EXT_TITLE_FONT = 11;

/* ------------------------------------------------------------------ */
/* 归一化                                                              */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function asNullableString(value: unknown): string | null {
  const text = asString(value).trim();
  return text ? text : null;
}

const EMPTY_COUNTS: Exam408MapNodeCounts = { cards: 0, demos: 0, questions: 0 };

function normalizeCounts(value: unknown): Exam408MapNodeCounts {
  const record = asRecord(value);
  return {
    cards: asNumber(record.cards, 0),
    demos: asNumber(record.demos, 0),
    questions: asNumber(record.questions, 0),
  };
}

/** 标题去掉 cs408 的图表前缀（📊 等）与首尾空白 */
export function cleanMapNodeTitle(raw: string): string {
  return String(raw ?? "")
    .replace(/^[^\u4e00-\u9fffA-Za-z0-9]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKnowledgeMapNode(raw: unknown, index = 0): Exam408KnowledgeMapNode {
  const item = asRecord(raw);
  const slug = asString(item.slug);
  return {
    slug,
    title: cleanMapNodeTitle(asString(item.title, slug || "未命名节点")),
    type: asString(item.type) === "ext" ? "ext" : "core",
    desc: asString(item.desc),
    order: asNumber(item.order, index),
    studyKey: asNullableString(item.studyKey),
    studySlug: asNullableString(item.studySlug) ?? (slug || null),
    importance: asString(item.importance, "common"),
    examFrequency: asNumber(item.examFrequency, 0),
    pointKey: asNullableString(item.pointKey),
    counts: normalizeCounts(item.counts),
  };
}

/**
 * 图谱归一化：接口返回 { map: {...} }，但库里的 map 列只有 chapter + nodes，
 * 因此章节/key/科目都从外层兜。节点按 order 排序（order 相同保持接口顺序）。
 */
export function normalizeKnowledgeMap(payload: unknown): Exam408KnowledgeMap | null {
  const outer = asRecord(payload);
  const candidate = asRecord(outer.map ?? outer.knowledgeMap ?? outer);
  const rawNodes = Array.isArray(candidate.nodes) ? candidate.nodes : Array.isArray(outer.nodes) ? outer.nodes : [];
  if (rawNodes.length === 0) return null;
  const nodes = rawNodes
    .map((node, index) => normalizeKnowledgeMapNode(node, index))
    .filter((node) => node.slug || node.title)
    .sort((a, b) => a.order - b.order);
  if (nodes.length === 0) return null;
  return {
    key: asString(candidate.key ?? outer.key),
    subjectKey: asString(candidate.subjectKey ?? candidate.subject_key ?? outer.subjectKey ?? outer.subject_key),
    chapter: asString(candidate.chapter ?? outer.chapter, "本章"),
    topicSlug: asString(candidate.topicSlug ?? candidate.topic_slug ?? outer.topicSlug ?? outer.topic_slug),
    nodes,
  };
}

/* ------------------------------------------------------------------ */
/* 跳转                                                                */
/* ------------------------------------------------------------------ */

export interface MapNodeRoute {
  channel: string;
  path: string;
  params: Record<string, string>;
}

/** 节点点击去向：优先精读文章（有正文），退到专区知识点；都没有返回 null（渲染成静态节点） */
export function knowledgeMapNodeRoute(node: Exam408KnowledgeMapNode): MapNodeRoute | null {
  const studySlug = (node.studySlug ?? "").trim();
  if (studySlug) {
    return {
      channel: "exam-408-study-read",
      path: "/exam-408-study-read?slug=" + encodeURIComponent(studySlug),
      params: { slug: studySlug },
    };
  }
  const pointKey = (node.pointKey ?? "").trim();
  if (pointKey) {
    return {
      channel: "quiz-408-point",
      path: "/quiz/408-point?key=" + encodeURIComponent(pointKey),
      params: { key: pointKey },
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 折行 + 文案                                                         */
/* ------------------------------------------------------------------ */

/** 显示宽度：中文/全角 1，西文与数字 0.55（够用的估算，避免依赖字体度量） */
export function mapTextUnits(text: string): number {
  let units = 0;
  for (const char of String(text ?? "")) {
    const code = char.codePointAt(0) ?? 0;
    units += code > 0x2e7f ? 1 : 0.55;
  }
  return units;
}

/** 按最大宽度折行；超出行数时末行加省略号（SVG 没有 text-overflow） */
export function wrapMapLabel(text: string, maxUnits: number, maxLines = 3): string[] {
  const source = String(text ?? "").trim();
  if (!source) return [""];
  const limit = Math.max(2, maxUnits);
  const lines: string[] = [];
  let current = "";
  let used = 0;
  for (const char of source) {
    const units = mapTextUnits(char);
    if (used + units > limit && current) {
      lines.push(current);
      current = char;
      used = units;
      if (lines.length === maxLines) break;
    } else {
      current += char;
      used += units;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;
  const consumed = lines.join("").length;
  if (consumed < source.length) {
    const last = lines[lines.length - 1] ?? "";
    lines[lines.length - 1] = (last.length > 1 ? last.slice(0, -1) : last) + "…";
  }
  return lines.length > 0 ? lines : [""];
}

/** 节点第二行小字：类型 + 考频（有真题才写次数） */
export function mapNodeMeta(node: Exam408KnowledgeMapNode): string {
  const typeLabel = node.type === "ext" ? "补充" : "核心";
  if (node.examFrequency > 0) return typeLabel + " · 真题 " + node.examFrequency + " 次";
  if (node.counts.questions > 0) return typeLabel + " · " + node.counts.questions + " 题";
  return typeLabel;
}

/* ------------------------------------------------------------------ */
/* 布局                                                               */
/* ------------------------------------------------------------------ */

const SPINE_GAP = 16;
const CHAPTER_GAP = 22;
const EXT_GAP = 10;

function nodeHeight(lines: number, fontSize: number, metaFontSize: number): number {
  return 20 + lines * (fontSize + 4) + metaFontSize;
}

/**
 * 布局：章节起点在最上方，core 沿一条竖线按 order 排列，ext 作为虚线旁支挂在
 * 「最近一条主线」的右侧（多条旁支向下堆叠）。
 *
 * 为什么用竖版而不是原网页的力导向/环形：手机是竖屏，竖排主线最省横向空间，
 * 且与「精读按章节顺序读」的心智一致；11 个节点的最长图谱在 520 逻辑宽下约 700 高，
 * 缩放后仍可一屏看到主结构。
 */
export function layoutKnowledgeMap(map: Exam408KnowledgeMap, options?: { width?: number }): MapLayout {
  /**
   * 逻辑单位 = 渲染像素：列宽按视口宽度等比切分（主线约 60%，旁支约 40%），
   * 这样 zoom=1 时 SVG 不需要整体缩放，正文字号就是设计字号（不会糊成 8px）。
   */
  const width = Math.max(MAP_MIN_WIDTH, Math.round(options?.width ?? MAP_CANVAS_WIDTH));
  const padding = MAP_PADDING;
  const contentWidth = width - padding * 2;
  const spineWidth = Math.max(150, Math.round((contentWidth - MAP_COLUMN_GUTTER) * 0.6));
  const extWidth = Math.max(96, contentWidth - MAP_COLUMN_GUTTER - spineWidth);
  const chapterWidth = contentWidth;
  const spineX = padding;
  const extX = padding + spineWidth + MAP_COLUMN_GUTTER;

  const chapterLines = wrapMapLabel(map.chapter || "本章", Math.floor((chapterWidth - 24) / 15), 1);
  const chapterHeight = 42;
  const chapter: MapNodeBox = {
    node: {
      slug: "__chapter__",
      title: map.chapter || "本章",
      type: "core",
      desc: "",
      order: -1,
      studyKey: null,
      studySlug: null,
      importance: "common",
      examFrequency: 0,
      pointKey: null,
      counts: EMPTY_COUNTS,
    },
    kind: "chapter",
    x: padding,
    y: 0,
    width: chapterWidth,
    height: chapterHeight,
    lines: chapterLines,
    meta: map.nodes.length + " 个知识点",
  };

  const boxes: MapNodeBox[] = [];
  const edges: MapEdge[] = [];
  let y = chapterHeight + CHAPTER_GAP;
  let spineCenterX = spineX + spineWidth / 2;
  let lastSpineRight = spineX + spineWidth;
  let extCursorY = -1;
  let height = y;
  /** 上一条主线节点（只用来连主线竖线，绝不能连到旁支上） */
  let lastCoreBox: MapNodeBox | null = null;

  for (const node of map.nodes) {
    if (node.type === "ext") {
      const lines = wrapMapLabel(node.title, Math.floor((extWidth - 14) / EXT_TITLE_FONT), 3);
      const boxHeight = nodeHeight(lines.length, EXT_TITLE_FONT, 13);
      // 旁支挂在「最近一条主线」的右侧；若旁支排在最前（cs408 里确实有：绪论的补充考点 order=0），
      // 就挂在章节起点下方，绝不能和章节卡片重叠
      const anchorY = lastCoreBox ? lastCoreBox.y + lastCoreBox.height / 2 : chapterHeight;
      const desiredY = lastCoreBox ? anchorY - boxHeight / 2 : chapterHeight + CHAPTER_GAP - 6;
      const boxY = Math.max(chapterHeight + 8, extCursorY >= 0 ? Math.max(desiredY, extCursorY + EXT_GAP) : desiredY);
      const box: MapNodeBox = {
        node,
        kind: "ext",
        x: extX,
        y: boxY,
        width: extWidth,
        height: boxHeight,
        lines,
        meta: mapNodeMeta(node),
      };
      boxes.push(box);
      edges.push({
        kind: "branch",
        x1: Math.min(lastSpineRight, extX - 2),
        y1: anchorY,
        x2: extX,
        y2: boxY + boxHeight / 2,
        dashed: true,
      });
      extCursorY = boxY + boxHeight;
      height = Math.max(height, extCursorY + SPINE_GAP);
      continue;
    }

    const lines = wrapMapLabel(node.title, Math.floor((spineWidth - 18) / SPINE_TITLE_FONT), 3);
    const boxHeight = nodeHeight(lines.length, SPINE_TITLE_FONT, 13);
    const box: MapNodeBox = {
      node,
      kind: "core",
      x: spineX,
      y,
      width: spineWidth,
      height: boxHeight,
      lines,
      meta: mapNodeMeta(node),
    };
    boxes.push(box);

    edges.push({
      kind: "spine",
      x1: spineCenterX,
      y1: lastCoreBox ? lastCoreBox.y + lastCoreBox.height : chapterHeight,
      x2: spineCenterX,
      y2: y,
      dashed: false,
    });

    y += boxHeight + SPINE_GAP;
    lastCoreBox = box;
    lastSpineRight = spineX + spineWidth;
    height = Math.max(height, y);
    extCursorY = -1;
  }

  return { width, height: Math.max(height, chapterHeight + 40), chapter, nodes: boxes, edges };
}

/** 视口：zoom=1 时按宽度铺满，高度取内容高度（缩放后内容溢出由 clampMapPan 处理） */
export function mapViewport(layout: MapLayout, viewportWidth: number): MapViewport {
  const fitScale = Math.max(0.2, viewportWidth / layout.width);
  return { fitScale, height: Math.max(180, Math.round(layout.height * fitScale)) };
}

/** 缩放钳制（1~3 倍） */
export function clampMapZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, zoom));
}

/**
 * 平移钳制：内容缩放后宽高为 scale*content，超出视口的部分才允许拖动；
 * 不足视口的方向固定在 0，保证图不会被拖出画面（真机上手感最差的就是「拖到空白」）。
 */
export function clampMapPan(
  translateX: number,
  translateY: number,
  scale: number,
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { translateX: number; translateY: number } {
  const overflowX = Math.max(0, contentWidth * scale - viewportWidth);
  const overflowY = Math.max(0, contentHeight * scale - viewportHeight);
  return {
    translateX: Math.min(0, Math.max(-overflowX, translateX)),
    translateY: Math.min(0, Math.max(-overflowY, translateY)),
  };
}

/** 命中测试：逻辑坐标 → 节点（供画布兜底点击/无障碍分组使用） */
export function hitTestMapNode(layout: MapLayout, x: number, y: number): MapNodeBox | null {
  const all = [layout.chapter, ...layout.nodes];
  for (const box of all) {
    if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) return box;
  }
  return null;
}

/** 把屏幕坐标（相对视口左上角）反解成逻辑坐标（配合 scale + translate） */
export function screenToMapPoint(
  screenX: number,
  screenY: number,
  transform: MapTransform,
): { x: number; y: number } {
  const scale = transform.scale || 1;
  return { x: (screenX - transform.translateX) / scale, y: (screenY - transform.translateY) / scale };
}

/* ------------------------------------------------------------------ */
/* 请求                                                               */
/* ------------------------------------------------------------------ */

async function requestJson(path: string): Promise<unknown> {
  const { getApiUrl } = await import("@/config");
  const base = getApiUrl().replace(/\/+$/, "");
  const response = await fetch(base + path);
  if (!response.ok) {
    let message = "请求失败（" + response.status + "）";
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // 保持默认文案
    }
    throw new Error(message);
  }
  return (await response.json()) as unknown;
}

/** 按精读文章 slug 取章节图谱（接口：GET /api/exam/408/map?topic=<slug>） */
export async function getExam408KnowledgeMap(topicSlug: string): Promise<Exam408KnowledgeMap | null> {
  const payload = await requestJson("/api/exam/408/map?topic=" + encodeURIComponent(topicSlug));
  return normalizeKnowledgeMap(payload);
}
