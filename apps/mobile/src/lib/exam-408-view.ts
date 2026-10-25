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
 * 知识点页的跳转 href（v1.50 修复：章节题目「永远同一套」的真根因）。
 *
 * 真机取证（nginx access log，2026-10-25 13:31）：连续点开不同章节的知识点，
 * App 端 6 次请求的 key 全部是第一次的 `beokayy-408/ds-02-01` —— `router.push({pathname, params})`
 * **对象形式**在 native-stack 上重复推入同名路由时，`useLocalSearchParams` 拿到的 params
 * 冻结在首次值。改用**字符串 href** 形式：每次 push 都重新解析 URL（expo-router 的
 * parseQueryParams → URL searchParams，值里的 `%2F` 正确解码），params 不再复用。
 * 纯函数放 lib 是为了用单测钉住「含斜杠的 key 必须整体编码」这个关键行为。
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
