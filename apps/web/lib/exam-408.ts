import { pgPool } from "@/lib/db";

export interface Exam408Source {
  key: string;
  name: string;
  baseUrl: string;
  licenseNote: string;
  capturedAt: string | null;
}

export interface Exam408PointSummary {
  key: string;
  title: string;
  pointNumber: number;
  questionCount: number;
  tags: string[];
}

export interface Exam408ChapterSummary {
  key: string;
  title: string;
  chapterNumber: number;
  questionCount: number;
  points: Exam408PointSummary[];
}

export interface Exam408SubjectSummary {
  key: string;
  shortName: string;
  title: string;
  chapterCount: number;
  pointCount: number;
  questionCount: number;
  chapters: Exam408ChapterSummary[];
}

export interface Exam408PaperSummary {
  year: number;
  title: string;
  totalScore: number;
  questionCount: number;
}

export interface Exam408Overview {
  source: Exam408Source;
  stats: {
    subjects: number;
    chapters: number;
    points: number;
    papers: number;
    questions: number;
  };
  subjects: Exam408SubjectSummary[];
  papers: Exam408PaperSummary[];
}

export interface Exam408Option {
  letter: string;
  text: string;
}

export interface Exam408KnowledgeLink {
  key: string;
  title: string;
}

export interface Exam408Question {
  key: string;
  id: string;
  year: number;
  number: number;
  type: "choice" | "comprehensive";
  subject: {
    key: string;
    title: string;
  };
  points: number;
  body: string;
  stem: string;
  options: Exam408Option[];
  answerText: string;
  answerLetter: string | null;
  imageRefs: string[];
  answerImageRefs: string[];
  videoUrl: string | null;
  tags: string[];
  knowledgePoints: Exam408KnowledgeLink[];
}

export interface Exam408Paper {
  source: Exam408Source;
  paper: Exam408PaperSummary;
  sections: Array<{
    type: "choice" | "comprehensive";
    title: string;
    from: number;
    to: number;
    totalScore: number;
  }>;
  questions: Exam408Question[];
}

export interface Exam408PointDetail {
  source: Exam408Source;
  point: {
    key: string;
    title: string;
    summary: string;
    questionCount: number;
    tags: string[];
    subject: { key: string; title: string };
    chapter: { key: string; title: string; chapterNumber: number };
  };
  questions: Exam408Question[];
}

export async function getExam408Overview(): Promise<Exam408Overview> {
  const [sourceRows, subjectRows, chapterRows, pointRows, paperRows] =
    await Promise.all([
      readSource(),
      pgPool.query<{
        key: string;
        short_name: string;
        title: string;
      }>(
        `SELECT key, short_name, title
           FROM exam_408_subjects
          ORDER BY sort_order, key`,
      ),
      pgPool.query<{
        key: string;
        subject_key: string;
        chapter_number: number;
        title: string;
        question_count: number;
      }>(
        `SELECT key, subject_key, chapter_number, title, question_count
           FROM exam_408_chapters
          ORDER BY subject_key, sort_order, chapter_number`,
      ),
      pgPool.query<{
        key: string;
        chapter_key: string;
        point_number: number;
        title: string;
        question_count: number;
        tags: unknown;
      }>(
        `SELECT key, chapter_key, point_number, title, question_count, tags
           FROM exam_408_knowledge_points
          WHERE status = 'published'
          ORDER BY chapter_key, sort_order, point_number`,
      ),
      pgPool.query<{
        year: number;
        title: string;
        total_score: number;
        question_count: number;
      }>(
        `SELECT year, title, total_score, question_count
           FROM exam_408_papers
          WHERE status = 'published'
          ORDER BY year`,
      ),
    ]);

  const pointsByChapter = new Map<string, Exam408PointSummary[]>();
  for (const row of pointRows.rows) {
    const point: Exam408PointSummary = {
      key: row.key,
      title: row.title,
      pointNumber: Number(row.point_number),
      questionCount: Number(row.question_count),
      tags: stringArray(row.tags),
    };
    const list = pointsByChapter.get(row.chapter_key) ?? [];
    list.push(point);
    pointsByChapter.set(row.chapter_key, list);
  }

  const chaptersBySubject = new Map<string, Exam408ChapterSummary[]>();
  for (const row of chapterRows.rows) {
    const chapter: Exam408ChapterSummary = {
      key: row.key,
      title: row.title,
      chapterNumber: Number(row.chapter_number),
      questionCount: Number(row.question_count),
      points: pointsByChapter.get(row.key) ?? [],
    };
    const list = chaptersBySubject.get(row.subject_key) ?? [];
    list.push(chapter);
    chaptersBySubject.set(row.subject_key, list);
  }

  const subjects = subjectRows.rows.map((row) => {
    const chapters = chaptersBySubject.get(row.key) ?? [];
    return {
      key: row.key,
      shortName: row.short_name,
      title: row.title,
      chapterCount: chapters.length,
      pointCount: chapters.reduce(
        (total, chapter) => total + chapter.points.length,
        0,
      ),
      questionCount: chapters.reduce(
        (total, chapter) => total + chapter.questionCount,
        0,
      ),
      chapters,
    };
  });

  const papers = paperRows.rows.map((row) => ({
    year: Number(row.year),
    title: row.title,
    totalScore: Number(row.total_score),
    questionCount: Number(row.question_count),
  }));

  return {
    source: sourceRows,
    stats: {
      subjects: subjects.length,
      chapters: subjects.reduce(
        (total, subject) => total + subject.chapterCount,
        0,
      ),
      points: subjects.reduce(
        (total, subject) => total + subject.pointCount,
        0,
      ),
      papers: papers.length,
      questions: papers.reduce(
        (total, paper) => total + paper.questionCount,
        0,
      ),
    },
    subjects,
    papers,
  };
}

export async function getExam408Paper(year: number): Promise<Exam408Paper | null> {
  const source = await readSource();
  const paperResult = await pgPool.query<{
    year: number;
    title: string;
    total_score: number;
    question_count: number;
  }>(
    `SELECT year, title, total_score, question_count
       FROM exam_408_papers
      WHERE year = $1 AND status = 'published'`,
    [year],
  );
  const paperRow = paperResult.rows[0];
  if (!paperRow) return null;

  const questionRows = await readQuestions(
    `WHERE q.paper_year = $1 AND q.status = 'published'
     ORDER BY q.question_number`,
    [year],
  );
  const questions = questionRows.map(mapQuestion);

  return {
    source,
    paper: {
      year: Number(paperRow.year),
      title: paperRow.title,
      totalScore: Number(paperRow.total_score),
      questionCount: Number(paperRow.question_count),
    },
    sections: buildSections(questions),
    questions,
  };
}

export async function getExam408Point(
  key: string,
): Promise<Exam408PointDetail | null> {
  const source = await readSource();
  const pointResult = await pgPool.query<{
    key: string;
    title: string;
    summary: string;
    question_count: number;
    tags: unknown;
    subject_key: string;
    subject_title: string;
    chapter_key: string;
    chapter_title: string;
    chapter_number: number;
  }>(
    `SELECT
       p.key,
       p.title,
       p.summary,
       p.question_count,
       p.tags,
       s.key AS subject_key,
       s.title AS subject_title,
       c.key AS chapter_key,
       c.title AS chapter_title,
       c.chapter_number
     FROM exam_408_knowledge_points p
     JOIN exam_408_subjects s ON s.key = p.subject_key
     JOIN exam_408_chapters c ON c.key = p.chapter_key
     WHERE p.key = $1 AND p.status = 'published'`,
    [key],
  );
  const pointRow = pointResult.rows[0];
  if (!pointRow) return null;

  const questionRows = await readQuestions(
    `JOIN exam_408_question_knowledge_points link ON link.question_key = q.key
     WHERE link.knowledge_point_key = $1 AND q.status = 'published'
     ORDER BY q.paper_year, q.question_number`,
    [key],
  );
  const questions = questionRows.map(mapQuestion);

  return {
    source,
    point: {
      key: pointRow.key,
      title: pointRow.title,
      summary: pointRow.summary,
      questionCount: Number(pointRow.question_count),
      tags: stringArray(pointRow.tags),
      subject: { key: pointRow.subject_key, title: pointRow.subject_title },
      chapter: {
        key: pointRow.chapter_key,
        title: pointRow.chapter_title,
        chapterNumber: Number(pointRow.chapter_number),
      },
    },
    questions,
  };
}

async function readSource(): Promise<Exam408Source> {
  const { rows } = await pgPool.query<{
    key: string;
    name: string;
    base_url: string;
    license_note: string;
    captured_at: Date | string | null;
  }>(
    `SELECT key, name, base_url, license_note, captured_at
       FROM exam_408_source_snapshots
      WHERE key = 'beokayy-408'`,
  );
  const row = rows[0];
  if (!row) throw new Error("408 source snapshot is missing.");
  return {
    key: row.key,
    name: row.name,
    baseUrl: row.base_url,
    licenseNote: row.license_note,
    capturedAt: row.captured_at
      ? new Date(row.captured_at).toISOString()
      : null,
  };
}

interface QuestionRow {
  key: string;
  question_id: string;
  paper_year: number;
  question_number: number;
  type: "choice" | "comprehensive";
  points: number;
  body: string;
  stem: string;
  options: unknown;
  answer_text: string;
  answer_letter: string | null;
  image_refs: unknown;
  answer_image_refs: unknown;
  video_url: string | null;
  tags: unknown;
  subject_key: string;
  subject_title: string;
  knowledge_points: unknown;
}

async function readQuestions(
  suffix: string,
  params: unknown[],
): Promise<QuestionRow[]> {
  const { rows } = await pgPool.query<QuestionRow>(
    `SELECT
       q.key,
       q.question_id,
       q.paper_year,
       q.question_number,
       q.type,
       q.points,
       q.body,
       q.stem,
       q.options,
       q.answer_text,
       q.answer_letter,
       q.image_refs,
       q.answer_image_refs,
       q.video_url,
       q.tags,
       s.key AS subject_key,
       s.title AS subject_title,
       COALESCE((
         SELECT jsonb_agg(
           jsonb_build_object('key', p.key, 'title', p.title)
           ORDER BY p.subject_key, p.sort_order
         )
         FROM exam_408_question_knowledge_points link
         JOIN exam_408_knowledge_points p ON p.key = link.knowledge_point_key
         WHERE link.question_key = q.key
       ), '[]'::jsonb) AS knowledge_points
     FROM exam_408_questions q
     JOIN exam_408_subjects s ON s.key = q.subject_key
     ${suffix}`,
    params,
  );
  return rows;
}

function mapQuestion(row: QuestionRow): Exam408Question {
  return {
    key: row.key,
    id: row.question_id,
    year: Number(row.paper_year),
    number: Number(row.question_number),
    type: row.type,
    subject: { key: row.subject_key, title: row.subject_title },
    points: Number(row.points),
    body: row.body,
    stem: row.stem,
    options: optionArray(row.options),
    answerText: row.answer_text,
    answerLetter: row.answer_letter,
    imageRefs: stringArray(row.image_refs),
    answerImageRefs: stringArray(row.answer_image_refs),
    videoUrl: row.video_url,
    tags: stringArray(row.tags),
    knowledgePoints: knowledgePointArray(row.knowledge_points),
  };
}

function buildSections(questions: Exam408Question[]) {
  const sections: Exam408Paper["sections"] = [];
  for (const question of questions) {
    const current = sections.at(-1);
    if (!current || current.type !== question.type) {
      sections.push({
        type: question.type,
        title: question.type === "choice" ? "单项选择题" : "综合应用题",
        from: question.number,
        to: question.number,
        totalScore: question.points,
      });
      continue;
    }
    current.to = question.number;
    current.totalScore += question.points;
  }
  return sections;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function optionArray(value: unknown): Exam408Option[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { letter: unknown; text: unknown } =>
        Boolean(item) && typeof item === "object",
    )
    .map((item) => ({
      letter: String(item.letter ?? ""),
      text: String(item.text ?? ""),
    }))
    .filter((item) => item.letter && item.text);
}

function knowledgePointArray(value: unknown): Exam408KnowledgeLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { key: unknown; title: unknown } =>
        Boolean(item) && typeof item === "object",
    )
    .map((item) => ({
      key: String(item.key ?? ""),
      title: String(item.title ?? ""),
    }))
    .filter((item) => item.key && item.title);
}
