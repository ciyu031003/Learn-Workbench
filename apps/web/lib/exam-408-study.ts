import { pgPool } from "@/lib/db";

/**
 * 408 精读（cs408.cloud 镜像）阅读数据层 —— Web 阅读器 / API / App 共用同一份契约。
 *
 * 数据：exam_408_study_topics（迁移 085），181 篇 Markdown 正文，图片已本地化到
 * /content-images/cs408/*.svg。来源许可：作者同意「个人学习、非商业用途」，保留署名与原文链接。
 *
 * 分层：
 *  - 查询（get*）：只做 SQL → 结构映射；
 *  - 纯函数（buildStudyOverview / parseStudyMarkdown / findStudyNeighbors / estimate...）：
 *    不碰 I/O，单测直接测，页面与 API 复用同一结果（树、目录、上一节/下一节）。
 *
 * 为什么自己写 Markdown 解析而不复用 parseMarkdownLite：cs408 正文是「教材式」长文，
 * 含表格、图片、$$ 公式块、iframe 交互图谱、多层列表 —— 这些 parseMarkdownLite 不覆盖。
 * 解析只产出结构块，由 Web/App 用原生节点渲染，不注入 HTML（零 XSS 面）。
 */

/* ------------------------------------------------------------------ */
/* 常量与主题                                                          */
/* ------------------------------------------------------------------ */

/** 内部学习台内的来源快照 key（迁移 085 登记）。 */
export const STUDY_SOURCE_KEY = "cs408-cloud";

/** 科目排序兜底（数据库里有 exam_408_subjects 时以库为准）。 */
export const STUDY_SUBJECT_FALLBACK: Readonly<
  Record<string, { title: string; shortName: string; sortOrder: number }>
> = {
  "data-structure": { title: "数据结构", shortName: "DS", sortOrder: 0 },
  "computer-organization": { title: "计算机组成原理", shortName: "CO", sortOrder: 1 },
  "operating-system": { title: "操作系统", shortName: "OS", sortOrder: 2 },
  "computer-network": { title: "计算机网络", shortName: "CN", sortOrder: 3 },
};

/** 数据库 subject_key 前缀（exam_408_subjects.key = beokayy-408/<slug>）。 */
const SUBJECT_KEY_PREFIX = "beokayy-408/";

/** 重要度（迁移 085 的 CHECK 枚举；旧快照里出现过 understand，做归一化）。 */
export type StudyImportance = "must" | "common" | "rare" | "none";

export interface StudyImportanceMeta {
  key: StudyImportance;
  /** 原始值（未识别的保留，便于排查） */
  raw: string;
  label: string;
  tone: "default" | "warning" | "muted" | "success";
}

const IMPORTANCE_LABELS: Record<string, StudyImportanceMeta> = {
  must: { key: "must", raw: "must", label: "重点必读", tone: "default" },
  understand: { key: "common", raw: "understand", label: "理解为主", tone: "warning" },
  common: { key: "common", raw: "common", label: "常考", tone: "warning" },
  rare: { key: "rare", raw: "rare", label: "低频", tone: "muted" },
  none: { key: "none", raw: "none", label: "了解", tone: "muted" },
};

/* ------------------------------------------------------------------ */
/* 类型：树 / 摘要 / 正文块                                             */
/* ------------------------------------------------------------------ */

export interface StudySource {
  key: string;
  name: string;
  baseUrl: string;
  licenseNote: string;
  capturedAt: string | null;
}

/** 列表与目录用的小卡片（不含正文，避免列表页拉 2MB 内容）。 */
export interface StudyTopicSummary {
  slug: string;
  title: string;
  chapter: string;
  chapterOrder: number;
  sortOrder: number;
  importance: StudyImportance;
  importanceLabel: string;
  examFrequency: number;
  knowledgePointKey: string | null;
  /** 由 content_md 字符数估算的阅读分钟数 */
  readingMinutes: number;
}

export interface StudyChapterGroup {
  chapter: string;
  chapterOrder: number;
  topics: StudyTopicSummary[];
}

export interface StudySubjectTree {
  key: string;
  title: string;
  shortName: string;
  chapterCount: number;
  topicCount: number;
  readingMinutes: number;
  chapters: StudyChapterGroup[];
}

export interface StudyTree {
  stats: {
    subjects: number;
    chapters: number;
    topics: number;
    readingMinutes: number;
  };
  subjects: StudySubjectTree[];
}

export interface StudyOverview extends StudyTree {
  source: StudySource;
}

export type StudyBlockAlign = "left" | "center" | "right";

/**
 * 正文结构块。全部是纯数据（可 JSON 序列化），Web 用原生节点渲染，App 也能直接消费。
 * 段落/列表/表格单元格里的行内标记（**粗体**、反引号代码、$公式$）由 md-lite 的 parseInlineRich 再切。
 */
export type StudyBlock =
  | { type: "heading"; id: string; level: number; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; items: Array<{ text: string; depth: number }> }
  | { type: "table"; header: string[]; rows: string[][]; align: StudyBlockAlign[] }
  | { type: "code"; lang: string; code: string }
  | { type: "quote"; lines: string[] }
  | { type: "image"; src: string; alt: string }
  | { type: "math"; tex: string }
  | { type: "iframe"; src: string; title: string }
  | { type: "divider" };

export interface StudyTocItem {
  id: string;
  text: string;
  level: number;
}

export interface StudyParsedMarkdown {
  blocks: StudyBlock[];
  toc: StudyTocItem[];
  stats: {
    chars: number;
    readingMinutes: number;
    headings: number;
    images: number;
    tables: number;
    codeBlocks: number;
    mathBlocks: number;
    callouts: number;
  };
}

export interface StudyTopicLink {
  slug: string;
  title: string;
  chapter: string;
}

export interface StudyTopicDetail {
  source: StudySource;
  subject: { key: string; title: string; shortName: string };
  topic: StudyTopicSummary & {
    contentMd: string;
    tags: string[];
    sourceUrl: string | null;
  };
  blocks: StudyBlock[];
  toc: StudyTocItem[];
  /** 首段（跳过标题与图片）用于列表与分享预览 */
  excerpt: string;
  prev: StudyTopicLink | null;
  next: StudyTopicLink | null;
}

/* ------------------------------------------------------------------ */
/* 纯函数：重要度 / 阅读时长 / 链接                                     */
/* ------------------------------------------------------------------ */

export function normalizeStudyImportance(value: unknown): StudyImportance {
  const raw = String(value ?? "").trim().toLowerCase();
  return IMPORTANCE_LABELS[raw]?.key ?? "common";
}

export function studyImportanceMeta(value: unknown): StudyImportanceMeta {
  const raw = String(value ?? "").trim().toLowerCase();
  return IMPORTANCE_LABELS[raw] ?? { key: "common", raw: raw || "common", label: "常考", tone: "warning" };
}

/** 中文教材的阅读速度按 450 字/分钟估（含公式与插图停留）。 */
export function estimateStudyReadingMinutes(charCount: number): number {
  const chars = Number.isFinite(charCount) ? Math.max(0, charCount) : 0;
  return Math.max(1, Math.ceil(chars / 450));
}

/** App Router 的 dynamic segment 在不同版本/编码下可能仍是百分号编码的 slug，统一解一次。 */
export function decodeStudySlug(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * 列表页只有 content_md 的字符数（不做 CJK 统计，避免 181 行正则拖慢首屏），
 * 按实测「2.5 个字符 ≈ 1 个汉字」折算成阅读分钟（约 450 汉字/分钟 → 1129 字符/分钟）。
 */
export function estimateStudySourceReadingMinutes(sourceChars: number): number {
  const chars = Number.isFinite(sourceChars) ? Math.max(0, sourceChars) : 0;
  return Math.max(1, Math.ceil(chars / 1129));
}

/** 列表/正文共用的路由：/learn/408/study/<slug>（slug 含中文，交给 encodeURIComponent）。 */
export function studyTopicHref(slug: string): string {
  return "/learn/408/study/" + encodeURIComponent(slug);
}

/** 只把本地绝对路径当图片（迁移后是 /content-images/cs408/*.svg）；外链交给原站。 */
export function isLocalStudyImage(src: string): boolean {
  return src.startsWith("/") && !src.startsWith("//");
}

/** 数据库 subject_key（beokayy-408/data-structure）→ 精读侧 slug（data-structure）。 */
export function normalizeStudySubjectKey(key: string): string {
  return key.startsWith(SUBJECT_KEY_PREFIX) ? key.slice(SUBJECT_KEY_PREFIX.length) : key;
}

/* ------------------------------------------------------------------ */
/* 纯函数：Markdown → 结构块                                            */
/* ------------------------------------------------------------------ */

const FENCE_RE = /^\s*(```|~~~)\s*([^`]*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const UL_RE = /^(\s*)([-*+])\s+(.*)$/;
const OL_RE = /^(\s*)(\d{1,3})[.)]\s+(.*)$/;
const TABLE_RE = /^\s*\|/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const DIVIDER_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/;
const HTML_IMAGE_RE = /<img\b([^>]*)>/;
const IFRAME_RE = /<iframe\b([^>]*)>/;
const TABLE_SEPARATOR_RE = /^:?-{2,}:?$/;
const BR_RE = /<br\s*\/?>/gi;

/** 行内出现的 $$...$$ 降级成单 $...$，避免渲染出多余美元符。 */
function normalizeInlineMath(text: string): string {
  return String(text).replace(/\$\$([^$\n]{1,200})\$\$/g, (_all, inner: string) => "$" + inner + "$");
}

/** 标题锚点：优先用 ASCII 词，纯中文标题退回 sec；序号保证唯一且稳定。 */
export function studyHeadingId(text: string, index: number): string {
  const words = String(text ?? "")
    .toLowerCase()
    .match(/[a-z0-9]+/g);
  const base = words && words.length > 0 ? words.join("-").slice(0, 40) : "sec";
  return "h-" + base + "-" + index;
}

function stripOuterPipes(line: string): string {
  const trimmed = line.trim();
  const body = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  return body.endsWith("|") ? body.slice(0, -1) : body;
}

function tableCells(line: string): string[] {
  const ESC = "\u0000";
  return stripOuterPipes(line)
    .replace(/\\\|/g, ESC)
    .split("|")
    .map((cell) => cell.trim().split(ESC).join("|"));
}

function tableAlign(cell: string): StudyBlockAlign {
  const value = cell.trim();
  const left = value.startsWith(":");
  const right = value.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return "left";
}

function attr(attrs: string, name: string): string {
  const match = new RegExp(name + "\\s*=\\s*\"([^\"]*)\"", "i").exec(attrs);
  return match?.[1] ?? "";
}

function looksLikeTableSeparator(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => TABLE_SEPARATOR_RE.test(cell.trim()));
}

/**
 * 把 cs408 的 Markdown 正文解析成结构块 + 目录。
 *
 * 支持：ATX 标题、段落（保留手工换行与 br）、有序/无序列表（含两层缩进）、
 * 表格（含对齐与转义竖线）、围栏代码块、引用提示块、图片、公式块、
 * iframe 交互图谱占位、分隔线；其余内容一律落到段落（不丢字）。
 */
export function parseStudyMarkdown(markdown: string): StudyParsedMarkdown {
  const source = String(markdown ?? "").replace(/\r\n?/g, "\n").replace(BR_RE, "\n");
  const lines = source.split("\n");
  const blocks: StudyBlock[] = [];
  const toc: StudyTocItem[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: Array<{ text: string; depth: number }> } | null = null;
  let quote: string[] | null = null;
  let headingIndex = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", lines: paragraph.map((line) => normalizeInlineMath(line.trim())) });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };
  const flushQuote = () => {
    if (!quote) return;
    blocks.push({ type: "quote", lines: quote.map((line) => normalizeInlineMath(line)) });
    quote = null;
  };
  const flush = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (trimmed === "") {
      flush();
      continue;
    }

    const fence = FENCE_RE.exec(line);
    if (fence) {
      flush();
      const marker = fence[1] ?? "```";
      const lang = (fence[2] ?? "").trim();
      const body: string[] = [];
      const closeRe = new RegExp("^\\s*" + marker.replace(/[.*+?${}()|[\]\\]/g, "\\$&") + "\\s*$");
      index += 1;
      while (index < lines.length) {
        const next = lines[index] ?? "";
        if (closeRe.test(next)) break;
        body.push(next);
        index += 1;
      }
      blocks.push({ type: "code", lang, code: body.join("\n").replace(/\n+$/, "") });
      continue;
    }

    if (trimmed.startsWith("$$")) {
      flush();
      const single = /^\$\$(.+?)\$\$/.exec(trimmed);
      if (single) {
        blocks.push({ type: "math", tex: single[1]?.trim() ?? "" });
        continue;
      }
      const body: string[] = [];
      const rest = trimmed.slice(2).trim();
      if (rest) body.push(rest);
      index += 1;
      while (index < lines.length) {
        const next = lines[index] ?? "";
        const close = next.trim().indexOf("$$");
        if (close >= 0) {
          const before = next.trim().slice(0, close).trim();
          if (before) body.push(before);
          break;
        }
        body.push(next);
        index += 1;
      }
      blocks.push({ type: "math", tex: body.join("\n").trim() });
      continue;
    }

    const iframe = IFRAME_RE.exec(line);
    if (iframe) {
      flush();
      blocks.push({ type: "iframe", src: attr(iframe[1] ?? "", "src"), title: attr(iframe[1] ?? "", "title") });
      continue;
    }

    const image = IMAGE_RE.exec(trimmed);
    if (image) {
      flush();
      blocks.push({ type: "image", alt: image[1] ?? "", src: image[2] ?? "" });
      continue;
    }
    const htmlImage = HTML_IMAGE_RE.exec(trimmed);
    if (htmlImage && trimmed.startsWith("<img")) {
      flush();
      blocks.push({
        type: "image",
        alt: attr(htmlImage[1] ?? "", "alt"),
        src: attr(htmlImage[1] ?? "", "src"),
      });
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flush();
      const level = (heading[1] ?? "#").length;
      const text = (heading[2] ?? "").trim();
      if (text.length > 0) {
        const id = studyHeadingId(text, headingIndex);
        headingIndex += 1;
        blocks.push({ type: "heading", id, level, text });
        if (level >= 2 && level <= 3) toc.push({ id, text, level });
      }
      continue;
    }

    if (TABLE_RE.test(line)) {
      flush();
      const rows: string[][] = [];
      let align: StudyBlockAlign[] = [];
      while (index < lines.length && TABLE_RE.test(lines[index] ?? "")) {
        const rowLine = lines[index] ?? "";
        if (looksLikeTableSeparator(rowLine)) {
          align = tableCells(rowLine).map(tableAlign);
        } else {
          rows.push(tableCells(rowLine));
        }
        index += 1;
      }
      index -= 1;
      const header = rows.shift() ?? [];
      const width = header.length;
      blocks.push({
        type: "table",
        header,
        rows: rows.filter((row) => row.length > 0).map((row) => row.slice(0, Math.max(width, row.length))),
        align: Array.from({ length: width }, (_, i) => align[i] ?? "left"),
      });
      continue;
    }

    const quoted = QUOTE_RE.exec(line);
    if (quoted) {
      flushParagraph();
      flushList();
      quote = quote ?? [];
      const content = (quoted[1] ?? "").trim();
      if (content) quote.push(content);
      continue;
    }

    const unordered = UL_RE.exec(line);
    const ordered = OL_RE.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      flushQuote();
      const isOrdered = Boolean(ordered);
      const indent = (ordered ?? unordered)?.[1]?.replace(/\t/g, "  ").length ?? 0;
      const text = ((ordered ?? unordered)?.[3] ?? "").trim();
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push({ text: normalizeInlineMath(text), depth: indent >= 2 ? 1 : 0 });
      continue;
    }

    if (DIVIDER_RE.test(line)) {
      flush();
      blocks.push({ type: "divider" });
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  }

  flush();

  const chars = countStudyChars(source);
  return {
    blocks,
    toc,
    stats: {
      chars,
      readingMinutes: estimateStudyReadingMinutes(chars),
      ...countStudyBlocks(blocks),
    },
  };
}

function countStudyChars(text: string): number {
  // 去掉 Markdown 结构性符号再计数，避免公式/表格符号把阅读时长算大
  return String(text ?? "")
    .replace(/[#>*`|~\-\s]+/g, "")
    .length;
}

function countStudyBlocks(blocks: StudyBlock[]) {
  let headings = 0;
  let images = 0;
  let tables = 0;
  let codeBlocks = 0;
  let mathBlocks = 0;
  let callouts = 0;
  for (const block of blocks) {
    if (block.type === "heading") headings += 1;
    else if (block.type === "image") images += 1;
    else if (block.type === "table") tables += 1;
    else if (block.type === "code") codeBlocks += 1;
    else if (block.type === "math") mathBlocks += 1;
    else if (block.type === "quote") callouts += 1;
  }
  return { headings, images, tables, codeBlocks, mathBlocks, callouts };
}

/** 首段摘要：跳过标题、图片、空段，取第一段正文的前 maxChars 字。 */
export function studyExcerpt(blocks: StudyBlock[], maxChars = 120): string {
  for (const block of blocks) {
    if (block.type === "paragraph") {
      const text = block.lines.join("").replace(/\s+/g, " ").trim();
      if (text) return text.length > maxChars ? text.slice(0, maxChars) + "…" : text;
    }
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* 纯函数：树与相邻文章                                                 */
/* ------------------------------------------------------------------ */

export interface StudyTopicRow {
  subject_key: string;
  chapter: string;
  chapter_order: number;
  sort_order: number;
  slug: string;
  title: string;
  importance: string;
  exam_frequency: number;
  knowledge_point_key: string | null;
  content_chars: number;
}

export interface StudySubjectRow {
  key: string;
  title: string;
  short_name: string;
  sort_order: number;
}

export function mapStudyTopicSummary(row: StudyTopicRow): StudyTopicSummary {
  const meta = studyImportanceMeta(row.importance);
  return {
    slug: row.slug,
    title: row.title,
    chapter: row.chapter,
    chapterOrder: Number(row.chapter_order) || 0,
    sortOrder: Number(row.sort_order) || 0,
    importance: meta.key,
    importanceLabel: meta.label,
    examFrequency: Number(row.exam_frequency) || 0,
    knowledgePointKey: row.knowledge_point_key ?? null,
    readingMinutes: estimateStudySourceReadingMinutes(Number(row.content_chars) || 0),
  };
}

export function compareStudyTopics(a: StudyTopicSummary, b: StudyTopicSummary): number {
  if (a.chapterOrder !== b.chapterOrder) return a.chapterOrder - b.chapterOrder;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  if (a.title !== b.title) return a.title.localeCompare(b.title, "zh-Hans-CN");
  return a.slug.localeCompare(b.slug);
}

/**
 * 把「全部主题行 + 科目行」组装成三套内容合并后的树：科目 → 章节 → 文章。
 * 科目顺序以数据库 sort_order 为准，缺库时用兜底表；没有正文的科目也保留（前端显示 0 篇）。
 */
export function buildStudyOverview(topics: StudyTopicRow[], subjects: StudySubjectRow[]): StudyTree {
  const subjectMeta = new Map<string, { title: string; shortName: string; sortOrder: number }>();
  for (const row of subjects) {
    const slug = normalizeStudySubjectKey(row.key);
    subjectMeta.set(slug, {
      title: row.title,
      shortName: row.short_name,
      sortOrder: Number(row.sort_order) || 0,
    });
  }
  for (const [slug, meta] of Object.entries(STUDY_SUBJECT_FALLBACK)) {
    if (!subjectMeta.has(slug)) subjectMeta.set(slug, meta);
  }

  const bySubject = new Map<string, StudyTopicRow[]>();
  for (const row of topics) {
    const slug = normalizeStudySubjectKey(row.subject_key);
    const list = bySubject.get(slug) ?? [];
    list.push(row);
    bySubject.set(slug, list);
  }

  const slugs = new Set<string>([...subjectMeta.keys(), ...bySubject.keys()]);

  const trees: StudySubjectTree[] = [];
  for (const slug of [...slugs].sort((a, b) => {
    const left = subjectMeta.get(a)?.sortOrder ?? 99;
    const right = subjectMeta.get(b)?.sortOrder ?? 99;
    return left - right || a.localeCompare(b);
  })) {
    const meta = subjectMeta.get(slug) ?? { title: slug, shortName: slug.slice(0, 2).toUpperCase(), sortOrder: 99 };
    const summaries = (bySubject.get(slug) ?? []).map(mapStudyTopicSummary).sort(compareStudyTopics);
    // cs408 的 chapter_order 实际是「文章级」序号（20010、20020… 每篇各不相同），
    // 所以章节只能按 chapter 名分组，章节序号取组内最小值；章节内顺序沿用 chapter_order。
    const chapterMap = new Map<string, StudyChapterGroup>();
    for (const topic of summaries) {
      const group = chapterMap.get(topic.chapter) ?? { chapter: topic.chapter, chapterOrder: topic.chapterOrder, topics: [] };
      group.chapterOrder = Math.min(group.chapterOrder, topic.chapterOrder);
      group.topics.push(topic);
      chapterMap.set(topic.chapter, group);
    }
    const chapters = [...chapterMap.values()].sort(
      (a, b) => a.chapterOrder - b.chapterOrder || a.chapter.localeCompare(b.chapter, "zh-Hans-CN"),
    );
    trees.push({
      key: slug,
      title: meta.title,
      shortName: meta.shortName,
      chapterCount: chapters.length,
      topicCount: summaries.length,
      readingMinutes: summaries.reduce((total, topic) => total + topic.readingMinutes, 0),
      chapters,
    });
  }

  const withTopics = trees.filter((tree) => tree.topicCount > 0);
  return {
    subjects: trees,
    stats: {
      subjects: withTopics.length,
      chapters: withTopics.reduce((total, tree) => total + tree.chapterCount, 0),
      topics: withTopics.reduce((total, tree) => total + tree.topicCount, 0),
      readingMinutes: withTopics.reduce((total, tree) => total + tree.readingMinutes, 0),
    },
  };
}

export interface StudyNeighbors {
  prev: StudyTopicLink | null;
  next: StudyTopicLink | null;
}

/** 同一科目内按（章节顺序, 章节内顺序）串成阅读链，给「上一节 / 下一节」。 */
export function findStudyNeighbors(topics: StudyTopicSummary[], slug: string): StudyNeighbors {
  const sorted = [...topics].sort(compareStudyTopics);
  const index = sorted.findIndex((topic) => topic.slug === slug);
  if (index < 0) return { prev: null, next: null };
  const toLink = (topic: StudyTopicSummary | undefined): StudyTopicLink | null =>
    topic ? { slug: topic.slug, title: topic.title, chapter: topic.chapter } : null;
  return { prev: toLink(sorted[index - 1]), next: toLink(sorted[index + 1]) };
}

/* ------------------------------------------------------------------ */
/* 查询                                                                */
/* ------------------------------------------------------------------ */

interface StudyTopicDbRow extends StudyTopicRow {
  content_md: string;
  tags: unknown;
  source_url: string | null;
}

const TOPIC_COLUMNS = `
  t.subject_key,
  t.chapter,
  t.chapter_order,
  t.sort_order,
  t.slug,
  t.title,
  t.importance,
  t.exam_frequency,
  t.knowledge_point_key,
  char_length(t.content_md) AS content_chars`;

export async function readStudySource(): Promise<StudySource> {
  const { rows } = await pgPool.query<{
    key: string;
    name: string;
    base_url: string;
    license_note: string;
    captured_at: Date | string | null;
  }>(
    `SELECT key, name, base_url, license_note, captured_at
         FROM exam_408_source_snapshots
        WHERE key = $1`,
    [STUDY_SOURCE_KEY],
  );
  const row = rows[0];
  if (!row) throw new Error("408 study source snapshot is missing.");
  return {
    key: row.key,
    name: row.name,
    baseUrl: row.base_url,
    licenseNote: row.license_note,
    capturedAt: row.captured_at ? new Date(row.captured_at).toISOString() : null,
  };
}

async function readStudySubjects(): Promise<StudySubjectRow[]> {
  const { rows } = await pgPool.query<StudySubjectRow>(
    `SELECT key, title, short_name, sort_order
       FROM exam_408_subjects
      WHERE key LIKE $1
      ORDER BY sort_order, key`,
    [SUBJECT_KEY_PREFIX + "%"],
  );
  return rows;
}

async function readStudyTopicRows(subjectKey?: string): Promise<StudyTopicRow[]> {
  const params: unknown[] = [];
  let where = "WHERE t.status = 'published'";
  if (subjectKey) {
    params.push(subjectKey);
    where += " AND t.subject_key = $1";
  }
  const { rows } = await pgPool.query<StudyTopicRow>(
    `SELECT ${TOPIC_COLUMNS}
       FROM exam_408_study_topics t
       ${where}
      ORDER BY t.subject_key, t.chapter_order, t.sort_order, t.slug`,
    params,
  );
  return rows;
}

/** 全部精读树（科目 → 章节 → 文章），列表页与 App 首屏共用。 */
export async function getExam408StudyOverview(): Promise<StudyOverview> {
  const [source, subjects, topics] = await Promise.all([
    readStudySource(),
    readStudySubjects(),
    readStudyTopicRows(),
  ]);
  return { source, ...buildStudyOverview(topics, subjects) };
}

/** 单个科目的章节树；科目没有正文时返回 null。 */
export async function getExam408StudySubject(
  subjectKey: string,
): Promise<{ source: StudySource; subject: StudySubjectTree } | null> {
  const [source, subjects, topics] = await Promise.all([
    readStudySource(),
    readStudySubjects(),
    readStudyTopicRows(subjectKey),
  ]);
  if (topics.length === 0) return null;
  const overview = buildStudyOverview(topics, subjects);
  const subject = overview.subjects.find((item) => item.key === subjectKey);
  return subject ? { source, subject } : null;
}

/** 阅读器数据：正文解析 + 目录 + 上一节/下一节（同一科目内按章节顺序）。 */
export async function getExam408StudyTopic(slug: string): Promise<StudyTopicDetail | null> {
  const source = await readStudySource();
  const topicResult = await pgPool.query<StudyTopicDbRow>(
    `SELECT ${TOPIC_COLUMNS}, t.content_md, t.tags, t.source_url
       FROM exam_408_study_topics t
      WHERE t.slug = $1 AND t.status = 'published'
      LIMIT 1`,
    [slug],
  );
  const row = topicResult.rows[0];
  if (!row) return null;

  const subjectKey = normalizeStudySubjectKey(row.subject_key);
  const [siblings, subjects] = await Promise.all([readStudyTopicRows(row.subject_key), readStudySubjects()]);
  const subjectMeta = buildStudyOverview(siblings, subjects).subjects.find((item) => item.key === subjectKey);

  const parsed = parseStudyMarkdown(row.content_md);
  const summary = mapStudyTopicSummary(row);
  const neighbors = findStudyNeighbors(siblings.map(mapStudyTopicSummary), row.slug);

  return {
    source,
    subject: {
      key: subjectKey,
      title: subjectMeta?.title ?? STUDY_SUBJECT_FALLBACK[subjectKey]?.title ?? subjectKey,
      shortName: subjectMeta?.shortName ?? STUDY_SUBJECT_FALLBACK[subjectKey]?.shortName ?? "",
    },
    topic: {
      ...summary,
      readingMinutes: estimateStudySourceReadingMinutes(row.content_md.length),
      contentMd: row.content_md,
      tags: stringArray(row.tags),
      sourceUrl: row.source_url,
    },
    blocks: parsed.blocks,
    toc: parsed.toc,
    excerpt: studyExcerpt(parsed.blocks),
    prev: neighbors.prev,
    next: neighbors.next,
  };
}

/** API 用：科目树（与 getExam408StudySubject 同源，保留语义化别名）。 */
export async function getExam408StudyChapters(
  subjectKey: string,
): Promise<{ source: StudySource; subject: StudySubjectTree } | null> {
  return getExam408StudySubject(subjectKey);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
