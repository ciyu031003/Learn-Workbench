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
