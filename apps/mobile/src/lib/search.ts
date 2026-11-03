import type { LearningStage, LearningTopic, LearningTrack } from "@learn-workbench/content/types";

/**
 * P2-3 · 全局搜索的纯逻辑层（不碰网络/存储，便于单测）。
 *
 * 两个数据源：
 * 1) 本地内容库（content-store 的 LearningTrack[]）：课程 / 主题 / 学习内容 三组；
 * 2) 408 专区搜索接口 GET /api/exam/408/search?q=（响应见 apps/web/lib/exam-408-search.ts：
 *    { query, total, limit, groups: [{ kind, label, total, hits: [{kind,key,title,snippet,href,meta}] }] }）。
 *
 * 页面（app/search.tsx）只负责输入、防抖、加载态与跳转；分组/匹配/摘要/路由映射都在这里，
 * 这样 320pt 窄屏与 130% 字号下的排版问题不会和搜索逻辑搅在一起。
 */

/* ---------------------------------- 通用 ---------------------------------- */

/** 搜索词清洗：去控制字符、折叠空白、去掉首尾空格（大小写不敏感由匹配方处理）。 */
export function normalizeSearchQuery(raw: string): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 大小写不敏感的子串匹配（CJK 直接按子串，英文忽略大小写）。 */
export function matchSearchQuery(haystack: string, needle: string): boolean {
  const target = normalizeSearchQuery(needle).toLowerCase();
  if (!target) return false;
  return String(haystack ?? "").toLowerCase().includes(target);
}

const SNIPPET_RADIUS = 32;

/** 在命中处两侧各留 radius 个字符做摘要；没有命中时保留开头。 */
export function buildSnippet(text: string, query: string, radius = SNIPPET_RADIUS): string {
  const source = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!source) return "";
  const needle = normalizeSearchQuery(query).toLowerCase();
  const index = needle ? source.toLowerCase().indexOf(needle) : -1;
  if (index < 0) {
    return source.length <= radius * 2 ? source : source.slice(0, radius * 2).trimEnd() + "…";
  }
  const start = Math.max(0, index - radius);
  const end = Math.min(source.length, index + needle.length + radius);
  return (start > 0 ? "…" : "") + source.slice(start, end).trim() + (end < source.length ? "…" : "");
}

/* ------------------------------- 命中词高亮 ------------------------------- */

/** 高亮片段：match=true 的片段由页面用主题主色 + 加粗渲染。 */
export interface HighlightSegment {
  text: string;
  match: boolean;
}

/** 正则元字符转义：搜索词按字面量匹配，避免用户输入的 `.`、`*` 改变语义。 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 把文本切成「命中 / 未命中」片段，供结果行用嵌套 Text 做高亮（不引第三方富文本库）。
 *
 * - 大小写不敏感：正则带 i 标志，片段取自原文，保留用户看到的原始大小写；
 * - CJK 直接按子串命中；
 * - 空搜索词返回单段 match=false（调用方不用特判，整段直接渲染）；
 * - 搜索词按字面量转义并逐段推进 lastIndex，相邻/重叠出现都不会死循环；
 *   片段按顺序拼起来恒等于原文，渲染不丢字。
 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const source = String(text ?? "");
  const needle = normalizeSearchQuery(query);
  if (!needle) return [{ text: source, match: false }];
  const pattern = new RegExp(escapeRegExp(needle), "gi");
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (let found = pattern.exec(source); found; found = pattern.exec(source)) {
    if (found.index > cursor) segments.push({ text: source.slice(cursor, found.index), match: false });
    segments.push({ text: found[0], match: true });
    cursor = found.index + found[0].length;
  }
  if (segments.length === 0) return [{ text: source, match: false }];
  if (cursor < source.length) segments.push({ text: source.slice(cursor), match: false });
  return segments;
}

/* ------------------------------- 本地内容库 ------------------------------- */

export type LocalSearchGroupKey = "course" | "topic" | "content";

export const LOCAL_SEARCH_GROUP_LABELS: Record<LocalSearchGroupKey, string> = {
  course: "课程",
  topic: "主题",
  content: "学习内容",
};

export const LOCAL_SEARCH_GROUP_ORDER: LocalSearchGroupKey[] = ["course", "topic", "content"];

/** 一条可搜索的本地条目（课程 / 主题 / 学习内容），命中后按 group 决定跳转。 */
export interface LearningSearchEntry {
  key: string;
  group: LocalSearchGroupKey;
  title: string;
  /** 命中候选：标题 + 摘要 + 正文要点（顺序即优先级） */
  fields: string[];
  /** 跳转所需的三元组 */
  trackSlug: string;
  stageKey: string;
  topicKey: string;
  /** 列表右侧/次行的来源说明，如「课程 · ICT 学习路线」 */
  meta: string;
}

/** 学习内容分组里参与检索的正文要点字段（与 KnowledgeReader 的段落一一对应）。 */
const TOPIC_CONTENT_FIELDS: ((topic: LearningTopic) => string[] | string | undefined)[] = [
  (topic) => topic.summary,
  (topic) => topic.concepts,
  (topic) => topic.principles,
  (topic) => topic.applications,
  (topic) => topic.pitfalls,
  (topic) => topic.method,
  (topic) => topic.exercise,
  (topic) => topic.checkpoint,
  (topic) => topic.lesson?.overview,
  (topic) => topic.lesson?.mechanism,
  (topic) => topic.lesson?.summary,
];

function toStrings(value: string[] | string | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter((item) => Boolean(item && item.trim())) : [value];
}

function stageTopic(stage: LearningStage): LearningTopic | null {
  return stage.topics.length > 0 ? stage.topics[0] : null;
}

/**
 * 把内容库摊平成可搜索条目：
 * - 课程：track.title / summary / whyLearn；
 * - 主题：stage.title / goal / outcome（跳该阶段第一个主题，保证阅读页有内容）；
 * - 学习内容：topic.title / summary / 正文要点（跳该主题）。
 */
export function buildLearningSearchEntries(tracks: readonly LearningTrack[]): LearningSearchEntry[] {
  const entries: LearningSearchEntry[] = [];
  for (const track of tracks) {
    entries.push({
      key: "course:" + track.slug,
      group: "course",
      title: track.title,
      fields: [track.title, track.summary, track.whyLearn, track.studyMethod.join(" ")],
      trackSlug: track.slug,
      stageKey: track.stages[0]?.key ?? "",
      topicKey: track.stages[0]?.topics[0]?.key ?? "",
      meta: "课程 · " + track.level,
    });
    for (const stage of track.stages) {
      const first = stageTopic(stage);
      entries.push({
        key: "topic:" + track.slug + "/" + stage.key,
        group: "topic",
        title: stage.title,
        fields: [stage.title, stage.goal, stage.outcome],
        trackSlug: track.slug,
        stageKey: stage.key,
        topicKey: first?.key ?? "",
        meta: track.title + " · " + stage.key,
      });
      for (const topic of stage.topics) {
        const fields = [topic.title, ...TOPIC_CONTENT_FIELDS.flatMap((pick) => toStrings(pick(topic)))];
        entries.push({
          key: "content:" + track.slug + "/" + stage.key + "/" + topic.key,
          group: "content",
          title: topic.title,
          fields,
          trackSlug: track.slug,
          stageKey: stage.key,
          topicKey: topic.key,
          meta: track.title + " · " + stage.title,
        });
      }
    }
  }
  return entries;
}

export interface LocalSearchHit {
  key: string;
  /** 所属分组：决定跳转目标（课程详情 / 阅读页） */
  group: LocalSearchGroupKey;
  title: string;
  snippet: string;
  meta: string;
  trackSlug: string;
  stageKey: string;
  topicKey: string;
}

export interface LocalSearchGroup {
  group: LocalSearchGroupKey;
  label: string;
  total: number;
  hits: LocalSearchHit[];
}

export const LOCAL_SEARCH_GROUP_LIMIT = 6;

/** 本地检索：标题命中排在本组前面，每组最多 limit 条，空查询返回空数组。 */
export function searchLearning(
  entries: readonly LearningSearchEntry[],
  query: string,
  limit = LOCAL_SEARCH_GROUP_LIMIT,
): LocalSearchGroup[] {
  const needle = normalizeSearchQuery(query);
  if (!needle) return [];
  const byGroup = new Map<LocalSearchGroupKey, LocalSearchHit[]>();
  let anyQuery = false;
  for (const entry of entries) {
    const matchedField = entry.fields.find((field) => matchSearchQuery(field, needle));
    if (!matchedField) continue;
    anyQuery = true;
    const snippetSource =
      matchedField === entry.title ? entry.fields.slice(1).find((field) => field.trim()) ?? entry.title : matchedField;
    const hit: LocalSearchHit = {
      key: entry.key,
      group: entry.group,
      title: entry.title,
      snippet: buildSnippet(snippetSource, needle),
      meta: entry.meta,
      trackSlug: entry.trackSlug,
      stageKey: entry.stageKey,
      topicKey: entry.topicKey,
    };
    const bucket = byGroup.get(entry.group);
    if (bucket) bucket.push(hit);
    else byGroup.set(entry.group, [hit]);
  }
  if (!anyQuery) return [];
  const groups: LocalSearchGroup[] = [];
  for (const group of LOCAL_SEARCH_GROUP_ORDER) {
    const hits = byGroup.get(group);
    if (!hits || hits.length === 0) continue;
    // 标题命中优先（同分保持内容库原始顺序，结果稳定可复现）
    const ranked = hits
      .map((hit, index) => ({ hit, index, titleHit: matchSearchQuery(hit.title, needle) ? 0 : 1 }))
      .sort((a, b) => a.titleHit - b.titleHit || a.index - b.index)
      .map((item) => item.hit);
    groups.push({ group, label: LOCAL_SEARCH_GROUP_LABELS[group], total: ranked.length, hits: ranked.slice(0, limit) });
  }
  return groups;
}

/* ------------------------------ 本地跳转映射 ------------------------------ */

export interface SearchRoute {
  /** expo-router 的路径（已做 encodeURIComponent） */
  href: string;
  /** 需要走场外通道防参数冻结时填通道名（quiz-read / exam-408-study-read） */
  navChannel?: "quiz-read" | "exam-408-study-read";
  navParams?: Record<string, string>;
}

/** 课程 → 课程详情；主题/学习内容 → 阅读页对应小节（带场外通道，防同名路由 params 冻结）。 */
export function learningEntryRoute(entry: {
  group: LocalSearchGroupKey;
  trackSlug: string;
  stageKey: string;
  topicKey: string;
}): SearchRoute {
  if (entry.group === "course") {
    return { href: "/quiz/" + encodeURIComponent(entry.trackSlug) };
  }
  const params = { track: entry.trackSlug, stage: entry.stageKey, topic: entry.topicKey };
  return {
    href:
      "/quiz/read?track=" +
      encodeURIComponent(params.track) +
      "&stage=" +
      encodeURIComponent(params.stage) +
      "&topic=" +
      encodeURIComponent(params.topic),
    navChannel: "quiz-read",
    navParams: params,
  };
}

/* -------------------------------- 408 搜索 -------------------------------- */

export type Exam408HitKind = "point" | "study" | "card" | "question";

export interface Exam408SearchHit {
  kind: Exam408HitKind;
  key: string;
  title: string;
  snippet: string;
  href: string;
  meta: string;
}

export interface Exam408SearchGroup {
  kind: Exam408HitKind;
  label: string;
  total: number;
  hits: Exam408SearchHit[];
}

export interface Exam408SearchResponse {
  query: string;
  total: number;
  limit: number;
  groups: Exam408SearchGroup[];
}

export const EXAM408_SEARCH_POINT_PREFIX = "beokayy-408/";

/** App 可打开的命中类型（速记卡/真题分别跳 app/exam-408-card 与 app/exam-408-question）。 */
export const EXAM408_SEARCH_KINDS: Exam408HitKind[] = ["study", "point", "card", "question"];

export const EXAM408_SEARCH_GROUP_LABELS: Record<string, string> = {
  study: "408 精读",
  point: "408 知识点",
  card: "408 速记卡",
  question: "408 真题",
};

/** 按 EXAM408_SEARCH_KINDS 的四组过滤，去掉空组；响应异常按空处理。 */
export function pickExam408Groups(result: Exam408SearchResponse | null | undefined): Exam408SearchGroup[] {
  if (!result || !Array.isArray(result.groups)) return [];
  const groups: Exam408SearchGroup[] = [];
  for (const kind of EXAM408_SEARCH_KINDS) {
    const group = result.groups.find((item) => item.kind === kind);
    if (!group || !Array.isArray(group.hits) || group.hits.length === 0) continue;
    groups.push({
      kind,
      label: EXAM408_SEARCH_GROUP_LABELS[kind] ?? group.label ?? kind,
      total: typeof group.total === "number" ? group.total : group.hits.length,
      hits: group.hits,
    });
  }
  return groups;
}

/**
 * 408 命中 → App 路由：
 * - 精读：/exam-408-study-read?slug=（场外通道 exam-408-study-read，防参数冻结）；
 * - 知识点：/quiz/408-point?key=（App 的知识点详情页；/exam-408 只接 Tab 参数，不认 key）；
 * - 速记卡：/exam-408-card?key=；真题：/exam-408-question?key=（详情页由 408 详情任务新建）。
 * 接口给的 href 是 Web 路径（/learn/408/...），App 不能直接用。
 */
export function exam408HitRoute(hit: { kind: Exam408HitKind; key: string }): SearchRoute {
  const key = encodeURIComponent(hit.key);
  if (hit.kind === "study") {
    return {
      href: "/exam-408-study-read?slug=" + key,
      navChannel: "exam-408-study-read",
      navParams: { slug: hit.key },
    };
  }
  if (hit.kind === "card") return { href: "/exam-408-card?key=" + key };
  if (hit.kind === "question") return { href: "/exam-408-question?key=" + key };
  return { href: "/quiz/408-point?key=" + key };
}

/* ------------------------------ 最近搜索存储 ------------------------------ */

export const RECENT_SEARCH_KEY = "lwb-global-search-recent-v1";
export const RECENT_SEARCH_LIMIT = 8;

/** 读盘/外部传入的任意数据 → 合法最近搜索列表（去空、去重、截断；大小写不敏感去重）。 */
export function sanitizeRecentSearches(raw: unknown, limit = RECENT_SEARCH_LIMIT): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (typeof item !== "string") continue;
    const value = normalizeSearchQuery(item);
    if (!value) continue;
    const token = value.toLowerCase();
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

/** 新搜索词置顶（同一词大小写不同视为同一条，保留最新写法），最多 limit 条。 */
export function pushRecentSearch(
  list: readonly string[],
  query: string,
  limit = RECENT_SEARCH_LIMIT,
): string[] {
  const value = normalizeSearchQuery(query);
  if (!value) return sanitizeRecentSearches(list, limit);
  const rest = sanitizeRecentSearches(list, limit).filter((item) => item.toLowerCase() !== value.toLowerCase());
  return sanitizeRecentSearches([value, ...rest], limit);
}

/** 从最近搜索里移除一个词（大小写不敏感；其余项保持原始顺序与写法，空词不删任何项）。 */
export function removeRecentSearch(list: readonly string[], keyword: string): string[] {
  const cleaned = sanitizeRecentSearches(list);
  const target = normalizeSearchQuery(keyword).toLowerCase();
  if (!target) return cleaned;
  return cleaned.filter((item) => item.toLowerCase() !== target);
}

/* -------------------------------- 热门搜索 -------------------------------- */

/**
 * 热门搜索常驻词：全部取自本仓真实内容（学习内容 + 408 专区），
 * 在「未输入」与「无结果」两个空态展示，点击即触发搜索。
 */
export const HOT_SEARCHES = ["索引", "死锁", "TCP", "红黑树", "进程", "排序", "银行家算法"] as const;
