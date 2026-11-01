import { getApiUrl } from "@/config";

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

export interface Exam408Question {
  key: string;
  id: string;
  year: number;
  number: number;
  type: "choice" | "comprehensive";
  subject: { key: string; title: string };
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
  knowledgePoints: { key: string; title: string }[];
}

export interface Exam408Paper {
  source: Exam408Source;
  paper: Exam408PaperSummary;
  sections: {
    type: "choice" | "comprehensive";
    title: string;
    from: number;
    to: number;
    totalScore: number;
  }[];
  questions: Exam408Question[];
}

export interface Exam408PointDetail {
  source: Exam408Source;
  point: {
    key: string;
    title: string;
    summary: string;
    /**
     * 知识点正文段落（v1.54.0）。旧数据可能整列缺省或为空数组，前端一律用
     * `exam408BodyParagraphs()` 归一化后再判空渲染。
     *
     * 注意与 `Exam408Question.body`（单道题的题干 markdown 原文，string）区分：
     * 这里是段落数组，一个元素对应界面上的一段。
     */
    body?: string[];
    questionCount: number;
    tags: string[];
    subject: { key: string; title: string };
    chapter: { key: string; title: string; chapterNumber: number };
  };
  questions: Exam408Question[];
}

export async function getExam408Overview(): Promise<Exam408Overview> {
  return request<Exam408Overview>("/api/exam/408/overview");
}

export async function getExam408Paper(year: number): Promise<Exam408Paper> {
  return request<Exam408Paper>(`/api/exam/408/paper?year=${encodeURIComponent(String(year))}`);
}

export async function getExam408Point(key: string): Promise<Exam408PointDetail> {
  return request<Exam408PointDetail>(`/api/exam/408/point?key=${encodeURIComponent(key)}`);
}

export function cleanExamStem(stem: string): string {
  return stem
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    // 非惊叹号的 [题X图 …](/content-images/…) 链接与 imageRefs 重复（快照已核实 38/38 覆盖），
    // 图片统一走 imageRefs 渲染，文本里只留说明文字
    .replace(/\[([^\]\n]*)\]\(\/content-images\/[^)\s]+\)/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanAnswerText(text: string): string {
  return text.replace(/^\s*答案\s*[:：]\s*[A-Z]?\s*/i, "").trim();
}

export function resolveExamAssetUrl(ref: string): string {
  if (/^https?:\/\//i.test(ref)) return ref;
  return getApiUrl().replace(/\/+$/, "") + (ref.startsWith("/") ? ref : `/${ref}`);
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(getApiUrl().replace(/\/+$/, "") + path);
  if (!response.ok) {
    let message = `请求失败（${response.status}）`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // 保持默认错误文案
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}
