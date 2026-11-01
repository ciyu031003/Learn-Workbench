import { externalizePointKey } from "@/lib/exam-408-point-key";
import type {
  Exam408ChapterSummary,
  Exam408Overview,
  Exam408SubjectSummary,
} from "@/lib/exam-408";

export const EXAM_408_EMPTY_STATS: Exam408Overview["stats"] = {
  subjects: 0,
  chapters: 0,
  points: 0,
  papers: 0,
  questions: 0,
};

const INTERNAL_TAGS = new Set(["408", "四〇八档案室"]);

/**
 * 知识点页的跳转 href。
 *
 * 历史：v1.50 曾把「点开所有知识点都是同一套题」归因于对象形式
 * `router.push({pathname, params})`，改为字符串 href —— **属误诊**：`resolveHref`
 * 会把两种形式归一成同一个 URL（`?key=` 整体 `encodeURIComponent`），params 冻结
 * 依旧（真机取证 2026-11-01：v1.50.0 上 4 个不同科目知识点的 5 次请求 key 全部
 * 是第一次的 ds-03-02）。真正的修复是场外通道 `lib/exam-408-pending.ts`：
 * 跳转方 push 前写入 key，知识点页聚焦时优先消费。
 *
 * 本函数保留：URL 仍是导航载体（深链/状态恢复），单测钉住「含斜杠的 key 必须
 * 整体编码」这个关键行为。防冻结的场外通道见 `lib/nav-pending.ts`。
 */
export function exam408PointHref(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "/quiz/408-point";
  // P7：App 内跳转统一用展示前缀 yuanabd-408（知识点页收到后再 internalize 回库内主键）
  return `/quiz/408-point?key=${encodeURIComponent(externalizePointKey(trimmed))}`;
}

/** 知识点正文的一段：heading 为 true 时按「小标题感」加粗渲染（段落以【开头）。 */
export type Exam408BodyParagraph = {
  text: string;
  heading: boolean;
};

/**
 * 知识点正文段落归一化（v1.54.0）。
 *
 * 数据库 exam_408_knowledge_points.body 是 jsonb string[]，但旧快照行没有正文列，
 * 线上接口可能返回 []、null 或整字段缺省；这里统一吸收成空数组，调用方据此整块不渲染。
 * 另外顺手丢弃空白串（服务端 trim 过，但客户端不能假设），保留段落顺序。
 */
export function exam408BodyParagraphs(
  body: readonly string[] | null | undefined,
): Exam408BodyParagraph[] {
  if (!Array.isArray(body)) return [];
  return body
    .filter((paragraph): paragraph is string => typeof paragraph === "string")
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((text) => ({ text, heading: text.startsWith("【") }));
}


export function resolveExam408Subject(
  overview: Exam408Overview | null,
  subjectKey: string,
): Exam408SubjectSummary | null {
  if (!overview || overview.subjects.length === 0) return null;
  return (
    overview.subjects.find((subject) => subject.key === subjectKey) ??
    overview.subjects[0] ??
    null
  );
}

export function exam408OverviewStats(
  overview: Exam408Overview | null,
): Exam408Overview["stats"] {
  return overview?.stats ?? EXAM_408_EMPTY_STATS;
}

export function exam408ChapterPreview(
  chapter: Exam408ChapterSummary,
  limit = 4,
): string {
  return chapter.points
    .slice(0, Math.max(0, limit))
    .map((point) => point.title)
    .join(" · ");
}

export function exam408DisplayTags(tags: string[], limit = 3): string[] {
  return tags
    .filter((tag) => !INTERNAL_TAGS.has(tag.trim()))
    .slice(0, Math.max(0, limit));
}

/**
 * 408 专区的真题索引科目（beokayy-408/<key>）→ ex-408-grad 讲义轨道的阶段 key。
 * 专区的知识点本身没有正文（只有标题/标签 + 关联真题），带正文的讲义在
 * ex-408-grad 轨道里（25 章级知识点，内容来自"计算机考研杂货铺"），按科目对应。
 * key 兼容带前缀与不带前缀两种形态；无对应阶段返回 null（调用方隐藏入口）。
 */
const GRAD_STAGE_BY_SUBJECT: Record<string, string> = {
  "data-structure": "ex408g-ds-stage",
  "computer-organization": "ex408g-co-stage",
  "operating-system": "ex408g-os-stage",
  "computer-network": "ex408g-net-stage",
};

export function exam408GradStageForSubject(subjectKey: string): string | null {
  const bare = subjectKey.trim().split("/").pop() ?? "";
  return GRAD_STAGE_BY_SUBJECT[bare] ?? null;
}