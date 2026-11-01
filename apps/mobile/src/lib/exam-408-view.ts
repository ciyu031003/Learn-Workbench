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
  return `/quiz/408-point?key=${encodeURIComponent(trimmed)}`;
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
