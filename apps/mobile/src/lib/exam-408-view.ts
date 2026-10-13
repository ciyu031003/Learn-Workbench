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
