import { pgPool } from "@/lib/db";

/**
 * 408 专区全局搜索（P5）：知识点 / 精读文章 / 速记卡 / 真题 四类内容统一检索。
 *
 * 为什么不用全文索引：四张表数据量小（知识点 99、精读 181、卡片 529、真题 846），
 * ILIKE 子串匹配 + 纯函数相关性排序足够快，也避免新增迁移与部署面。
 *
 * 分层：纯函数（清洗 / LIKE 转义 / 高亮 / 摘要 / 相关性排序 / 行数据 → 结果）单测直接覆盖；
 * I/O 只有 searchExam408（4 条只读 ILIKE 查询并行）。
 */

export const SEARCH_MAX_QUERY_LENGTH = 60;
export const SEARCH_GROUP_LIMIT = 8;

export const EXAM_408_SEARCH_KINDS = ["point", "study", "card", "question"] as const;
export type Exam408SearchKind = (typeof EXAM_408_SEARCH_KINDS)[number];

export const EXAM_408_SEARCH_KIND_LABELS: Record<Exam408SearchKind, string> = {
  point: "知识点",
  study: "精读",
  card: "速记卡",
  question: "真题",
};

/** 专区四个科目的展示名（库里既有 beokayy-408/xxx，也有裸 xxx） */
export const SEARCH_SUBJECT_TITLES: Record<string, string> = {
  "data-structure": "数据结构",
  "computer-organization": "计算机组成原理",
  "operating-system": "操作系统",
  "computer-network": "计算机网络",
};

export function searchSubjectTitle(subjectKey: string): string {
  const bare = String(subjectKey || "").split("/").at(-1) ?? "";
  return SEARCH_SUBJECT_TITLES[bare] ?? bare;
}

export function searchSubjectBareKey(subjectKey: string): string {
  return String(subjectKey || "").split("/").at(-1) ?? "";
}

export interface Exam408SearchHit {
  kind: Exam408SearchKind;
  key: string;
  title: string;
  snippet: string;
  href: string;
  meta: string;
}

export interface Exam408SearchGroup {
  kind: Exam408SearchKind;
  label: string;
  total: number;
  hits: Exam408SearchHit[];
}

export interface Exam408SearchResult {
  query: string;
  total: number;
  limit: number;
  groups: Exam408SearchGroup[];
}

/* ---------------- 纯函数：输入清洗 / LIKE / 高亮 / 摘要 ---------------- */

export function normalizeSearchQuery(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSearchQueryTooLong(query: string): boolean {
  return normalizeSearchQuery(query).length > SEARCH_MAX_QUERY_LENGTH;
}

export function escapeLikePattern(value: string): string {
  return String(value ?? "").replace(/[\\%_]/g, (character) => "\\" + character);
}

export function likePattern(query: string): string {
  return "%" + escapeLikePattern(normalizeSearchQuery(query)) + "%";
}

export function likePrefixPattern(query: string): string {
  return escapeLikePattern(normalizeSearchQuery(query)) + "%";
}

export interface SearchTextSegment {
  text: string;
  match: boolean;
}

/** 按搜索词切分文本（大小写不敏感、CJK 按子串），供 <mark> 渲染。 */
export function highlightSearchText(text: string, query: string): SearchTextSegment[] {
  const source = String(text ?? "");
  const needle = normalizeSearchQuery(query);
  if (!source) return [];
  if (!needle) return [{ text: source, match: false }];
  const haystack = source.toLowerCase();
  const target = needle.toLowerCase();
  const segments: SearchTextSegment[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const index = haystack.indexOf(target, cursor);
    if (index < 0) {
      segments.push({ text: source.slice(cursor), match: false });
      break;
    }
    if (index > cursor) segments.push({ text: source.slice(cursor, index), match: false });
    segments.push({ text: source.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
  }
  return segments.filter((segment) => segment.text.length > 0);
}

const SNIPPET_RADIUS = 40;

/** 命中处两侧各留 radius 个字符；没有命中时保留开头（超长加省略号）。 */
export function buildSearchSnippet(text: string, query: string, radius = SNIPPET_RADIUS): string {
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

/** 去掉 Markdown 常见标记，给真题题干做纯文本摘要。 */
export function cleanSearchText(text: string): string {
  return String(text ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[\x60*_>#]/g, "")
    .replace(/\$\$?/g, "")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 真题标题：题干首行清洗后截断；没有题干时退回「第 n 题」。 */
export function buildQuestionTitle(stem: string, questionNumber: number): string {
  const firstLine = String(stem ?? "")
    .split(/\n+/)
    .map((line) => cleanSearchText(line))
    .find((line) => line.length > 0);
  if (!firstLine) return "第 " + questionNumber + " 题";
  return firstLine.length <= 72 ? firstLine : firstLine.slice(0, 72) + "…";
}

/** 单字段相关度：完全相同 > 前缀 > 越靠前的子串命中 > 无命中。 */
export function scoreSearchText(text: string, query: string): number {
  const source = String(text ?? "").trim().toLowerCase();
  const needle = normalizeSearchQuery(query).toLowerCase();
  if (!source || !needle) return 0;
  if (source === needle) return 1000;
  if (source.startsWith(needle)) return 800;
  const index = source.indexOf(needle);
  if (index < 0) return 0;
  return Math.max(200, 600 - index);
}

/** 排序 + 截断：标题权重是摘要的 2 倍；同分按中文标题排序，保证结果稳定。 */
export function rankSearchHits(
  hits: Exam408SearchHit[],
  query: string,
  limit = SEARCH_GROUP_LIMIT,
): Exam408SearchHit[] {
  const scored = hits.map((hit) => ({
    hit,
    score: scoreSearchText(hit.title, query) * 2 + scoreSearchText(hit.snippet, query),
  }));
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.hit.title.localeCompare(b.hit.title, "zh-Hans-CN") ||
      a.hit.key.localeCompare(b.hit.key),
  );
  return scored.slice(0, Math.max(0, limit)).map((item) => item.hit);
}

/* ---------------- 纯函数：行数据 → 搜索结果 ---------------- */

export interface Exam408SearchPointRow {
  key: string;
  title: string;
  summary: string | null;
  subject_key: string;
  chapter_title: string | null;
}

export interface Exam408SearchStudyRow {
  slug: string;
  title: string;
  subject_key: string;
  chapter: string | null;
}

export interface Exam408SearchCardRow {
  key: string;
  question: string;
  subject_key: string;
  chapter: number | null;
}

export interface Exam408SearchQuestionRow {
  key: string;
  paper_year: number;
  question_number: number;
  type: string;
  subject_key: string;
  stem: string;
  body: string;
}

export interface Exam408SearchRows {
  points: Exam408SearchPointRow[];
  studies: Exam408SearchStudyRow[];
  cards: Exam408SearchCardRow[];
  questions: Exam408SearchQuestionRow[];
}

const EMPTY_ROWS: Exam408SearchRows = { points: [], studies: [], cards: [], questions: [] };

function metaJoin(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .join(" · ");
}

/** 行数据 → 分组结果（纯函数，Web/API 复用同一排序口径）。 */
export function buildExam408SearchResult(
  query: string,
  rows: Exam408SearchRows = EMPTY_ROWS,
  limit = SEARCH_GROUP_LIMIT,
): Exam408SearchResult {
  const normalized = normalizeSearchQuery(query);
  const pointHits: Exam408SearchHit[] = (rows.points ?? []).map((row) => ({
    kind: "point",
    key: row.key,
    title: row.title,
    snippet: buildSearchSnippet(row.summary ?? "", normalized),
    href: "/learn/408/points/" + row.key,
    meta: metaJoin([searchSubjectTitle(row.subject_key), row.chapter_title]),
  }));
  const studyHits: Exam408SearchHit[] = (rows.studies ?? []).map((row) => ({
    kind: "study",
    key: row.slug,
    title: row.title,
    snippet: "",
    href: "/learn/408/study/" + encodeURIComponent(row.slug),
    meta: metaJoin([searchSubjectTitle(row.subject_key), row.chapter]),
  }));
  const cardHits: Exam408SearchHit[] = (rows.cards ?? []).map((row) => ({
    kind: "card",
    key: row.key,
    title: row.question,
    snippet: "",
    href: "/learn/408/drill?subject=" + encodeURIComponent(searchSubjectBareKey(row.subject_key)),
    meta: metaJoin([
      searchSubjectTitle(row.subject_key),
      typeof row.chapter === "number" ? "第 " + row.chapter + " 章" : null,
    ]),
  }));
  const questionHits: Exam408SearchHit[] = (rows.questions ?? []).map((row) => {
    // 题干在 body 开头重复一次；摘要从题干之后开始，避免标题与摘要念两遍。
    const stemText = cleanSearchText(row.stem);
    const bodyText = cleanSearchText(row.body);
    const detailText = stemText && bodyText.startsWith(stemText)
      ? bodyText.slice(stemText.length).trim()
      : bodyText;
    return {
      kind: "question" as const,
      key: row.key,
      title: buildQuestionTitle(row.stem, row.question_number),
      snippet: buildSearchSnippet(detailText, normalized),
      href: "/learn/408/papers/" + row.paper_year,
      meta: metaJoin([
        row.paper_year + " 年",
        "第 " + row.question_number + " 题",
        row.type === "choice" ? "选择题" : "综合题",
      ]),
    };
  });

  const groupInputs: Array<{
    kind: Exam408SearchKind;
    label: string;
    hits: Exam408SearchHit[];
  }> = [
    { kind: "point", label: EXAM_408_SEARCH_KIND_LABELS.point, hits: pointHits },
    { kind: "study", label: EXAM_408_SEARCH_KIND_LABELS.study, hits: studyHits },
    { kind: "card", label: EXAM_408_SEARCH_KIND_LABELS.card, hits: cardHits },
    { kind: "question", label: EXAM_408_SEARCH_KIND_LABELS.question, hits: questionHits },
  ];
  const groups: Exam408SearchGroup[] = groupInputs.map((group) => {
    const hits = rankSearchHits(group.hits, normalized, limit);
    return { kind: group.kind, label: group.label, total: hits.length, hits };
  });

  const total = groups.reduce((sum, group) => sum + group.hits.length, 0);
  return { query: normalized, total, limit, groups };
}

/** 前端判断「有没有结果」的小工具，避免调用方重复写 flatMap。 */
export function flattenExam408SearchHits(result: Exam408SearchResult | null): Exam408SearchHit[] {
  if (!result) return [];
  return result.groups.flatMap((group) => group.hits);
}

/* ---------------- I/O：四条只读 ILIKE 查询 ---------------- */

type Queryable = { query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }> };

/**
 * 408 全局搜索。空查询/超长查询直接返回空结果（超长 400 由 API 层负责）；
 * 四类查询并行，任一失败整体抛错，由 API 统一转 500。
 */
export async function searchExam408(
  rawQuery: string,
  options: { limit?: number; client?: Queryable } = {},
): Promise<Exam408SearchResult> {
  const query = normalizeSearchQuery(rawQuery);
  const limit = Math.min(Math.max(1, options.limit ?? SEARCH_GROUP_LIMIT), SEARCH_GROUP_LIMIT);
  if (!query || isSearchQueryTooLong(query)) {
    return buildExam408SearchResult(query, EMPTY_ROWS, limit);
  }
  const client = options.client ?? (pgPool as unknown as Queryable);
  const pattern = likePattern(query);
  const prefix = likePrefixPattern(query);
  const fetchLimit = limit * 4;

  const [points, studies, cards, questions] = await Promise.all([
    client.query(
      "SELECT p.key, p.title, p.summary, p.subject_key, c.title AS chapter_title " +
        "FROM exam_408_knowledge_points p " +
        "LEFT JOIN exam_408_chapters c ON c.key = p.chapter_key " +
        "WHERE p.status = 'published' AND (p.title ILIKE $1 ESCAPE '\\' OR p.summary ILIKE $1 ESCAPE '\\') " +
        "ORDER BY CASE WHEN p.title ILIKE $2 ESCAPE '\\' THEN 0 WHEN p.title ILIKE $1 ESCAPE '\\' THEN 1 ELSE 2 END, " +
        "p.sort_order, p.point_number LIMIT $3",
      [pattern, prefix, fetchLimit],
    ),
    client.query(
      "SELECT slug, title, subject_key, chapter FROM exam_408_study_topics " +
        "WHERE status = 'published' AND title ILIKE $1 ESCAPE '\\' " +
        "ORDER BY chapter_order, sort_order LIMIT $2",
      [pattern, fetchLimit],
    ),
    client.query(
      "SELECT key, question, subject_key, chapter FROM exam_408_cards " +
        "WHERE status = 'published' AND question ILIKE $1 ESCAPE '\\' " +
        "ORDER BY sort_order, key LIMIT $2",
      [pattern, fetchLimit],
    ),
    client.query(
      "SELECT key, paper_year, question_number, type, subject_key, stem, body " +
        "FROM exam_408_questions " +
        "WHERE status = 'published' AND (stem ILIKE $1 ESCAPE '\\' OR body ILIKE $1 ESCAPE '\\') " +
        "ORDER BY paper_year DESC, question_number LIMIT $2",
      [pattern, fetchLimit],
    ),
  ]);

  return buildExam408SearchResult(
    query,
    {
      points: points.rows as Exam408SearchPointRow[],
      studies: studies.rows as Exam408SearchStudyRow[],
      cards: cards.rows as Exam408SearchCardRow[],
      questions: questions.rows as Exam408SearchQuestionRow[],
    },
    limit,
  );
}
