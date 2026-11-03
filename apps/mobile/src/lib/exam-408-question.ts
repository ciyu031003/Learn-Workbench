import { getApiUrl } from "@/config";
import type { Exam408Option, Exam408Question } from "@/lib/exam-408";

/**
 * 408 真题详情（P3-1）：App 客户端数据层。
 *
 * 契约（与 Web `GET /api/exam/408/question?key=` 逐字对齐，2026-11-03 定稿）：
 *   GET /api/exam/408/question?key=<encodeURIComponent(questionKey)>
 *   - 公开接口（不要求登录，不带 Authorization）；400：key 缺失 / 超 200 字符；
 *   - 404：题不存在或未发布；500：服务端异常；
 *   - 200：{ question: { key, id, year, number, type, subject, points, body, stem,
 *            options[], answerText, answerLetter, imageRefs[], answerImageRefs[],
 *            videoUrl, tags[], knowledgePoints[] } }
 *
 * 归一化纪律与 `exam-408-cards.ts` / `exam-408-topic.ts` 一致：
 * 服务端清洗过一次，但历史脏数据仍可能缺字段、混 snake_case、options 里混 null 或重复字母；
 * 详情页不能因为一个脏 option 白屏，所以逐字段兜底、非法项丢弃。
 */

/** 题 key 上限与 Web 端 MAX_QUESTION_KEY_LENGTH 对齐（超长直接判 400 语义）。 */
const MAX_QUESTION_KEY_LENGTH = 200;

export type Exam408QuestionFetchFailure = "invalid" | "not-found" | "offline" | "server";

export interface Exam408QuestionDetailFetch {
  detail: Exam408Question | null;
  failure: Exam408QuestionFetchFailure | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textOrNull(value: unknown): string | null {
  const trimmed = text(value);
  return trimmed.length > 0 ? trimmed : null;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function countNumber(value: unknown): number {
  const parsed = numberValue(value, 0);
  return parsed > 0 ? Math.floor(parsed) : 0;
}

/** 字符串数组归一化：丢弃非字符串与空白项（图片/标签/知识点 key 都走这里）。 */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const trimmed = text(item);
    if (trimmed) out.push(trimmed);
  }
  return out;
}

/**
 * 选择题选项归一化：letter 与 text 都非空才算有效项；重复 letter 只保留第一项
 * （服务端快照里出现过同字母重复行，重复渲染会让高亮命中错项）。
 */
export function normalizeQuestionOptions(value: unknown): Exam408Option[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const options: Exam408Option[] = [];
  for (const item of value) {
    const raw = asRecord(item);
    const letter = text(raw.letter);
    const optionText = text(raw.text);
    if (!letter || !optionText || seen.has(letter)) continue;
    seen.add(letter);
    options.push({ letter, text: optionText });
  }
  return options;
}

function normalizeKnowledgePoints(value: unknown): { key: string; title: string }[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const links: { key: string; title: string }[] = [];
  for (const item of value) {
    const raw = asRecord(item);
    // 契约里 knowledgePoints[].key 已是对外前缀（yuanabd-408/...），直接透传给知识点页；
    // 这里是只读展示，不需要 internalize。
    const key = text(raw.key);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    links.push({ key, title: text(raw.title) || key });
  }
  return links;
}

/**
 * 详情体归一化：payload 必须是 { question: {...} }，且 question.key 非空。
 *
 * 缺 id 用 key 兜底；type 只认 "comprehensive"，其余（含脏值）按 "choice"；
 * 数字字段缺失/非法一律 0（渲染层按「0 分」而不是 NaN 展示）。
 */
export function normalizeQuestionDetail(value: unknown): Exam408Question | null {
  const payload = asRecord(value);
  const raw = asRecord(payload.question);
  const key = text(raw.key);
  if (!key) return null;
  const subject = asRecord(raw.subject);
  return {
    key,
    id: text(raw.id) || key,
    year: countNumber(raw.year),
    number: countNumber(raw.number),
    type: raw.type === "comprehensive" ? "comprehensive" : "choice",
    subject: {
      key: text(subject.key ?? raw.subject_key),
      title: text(subject.title ?? raw.subject_title),
    },
    points: countNumber(raw.points),
    body: text(raw.body),
    stem: text(raw.stem),
    options: normalizeQuestionOptions(raw.options),
    answerText: text(raw.answerText ?? raw.answer_text),
    answerLetter: textOrNull(raw.answerLetter ?? raw.answer_letter),
    imageRefs: stringList(raw.imageRefs ?? raw.image_refs),
    answerImageRefs: stringList(raw.answerImageRefs ?? raw.answer_image_refs),
    videoUrl: textOrNull(raw.videoUrl ?? raw.video_url),
    tags: stringList(raw.tags),
    knowledgePoints: normalizeKnowledgePoints(raw.knowledgePoints ?? raw.knowledge_points),
  };
}

/**
 * 拉单道真题详情（公开接口，不带 Authorization）。
 *
 * 失败分类：
 * - "invalid"：客户端 key 为空/超长，或服务端 400（参数非法）；
 * - "not-found"：404（题不存在或未发布）；
 * - "offline"：fetch 抛错（网络不可用）；
 * - "server"：5xx / 401 / 其他非 2xx / 200 但结构不认识。
 */
export async function fetchQuestionDetail(questionKey: string): Promise<Exam408QuestionDetailFetch> {
  const key = questionKey.trim();
  if (!key || key.length > MAX_QUESTION_KEY_LENGTH) {
    return { detail: null, failure: "invalid" };
  }
  const url =
    getApiUrl().replace(/\/+$/, "") +
    "/api/exam/408/question?key=" +
    encodeURIComponent(key);

  let response: Response;
  try {
    // 公开接口：未登录也要能拉，因此不带 Authorization
    response = await fetch(url);
  } catch {
    return { detail: null, failure: "offline" };
  }

  if (response.status === 400) return { detail: null, failure: "invalid" };
  if (response.status === 404) return { detail: null, failure: "not-found" };
  if (!response.ok) return { detail: null, failure: "server" };

  let payload: unknown;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    // 200 但 body 不是 JSON（网关错误页等）：按服务端异常处理，不冒充离线
    return { detail: null, failure: "server" };
  }
  const detail = normalizeQuestionDetail(payload);
  if (!detail) return { detail: null, failure: "server" };
  return { detail, failure: null };
}
