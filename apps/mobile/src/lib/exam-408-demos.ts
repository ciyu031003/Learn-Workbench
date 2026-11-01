import { getApiUrl } from "@/config";

/**
 * 408 交互演示（移动端数据层）：与 Web 共用同一份 API 契约。
 *
 * - 列表：GET /api/exam/408/demos → { list: Exam408DemoSummary[] }
 * - 详情：GET /api/exam/408/demos?key=<demoKey> → { demo: Exam408DemoDetail }
 *
 * frame 是站点根路径（/content-demos/<demo>/<n>.webp）；移动端用 getApiUrl() 拼成绝对 URL。
 * 资产尚未抓取时 frame 可能为 null（纯文字步骤），播放器必须有占位态。
 */

export interface Exam408DemoStep {
  explain: string;
  frame: string | null;
}

export interface Exam408DemoSummary {
  key: string;
  subjectKey: string;
  title: string;
  description: string;
  frameCount: number;
  stepsCount: number;
  knowledgePointKey: string | null;
}

export interface Exam408DemoDetail {
  key: string;
  subjectKey: string;
  title: string;
  description: string;
  steps: Exam408DemoStep[];
  frameCount: number;
  knowledgePointKey: string | null;
  sourceUrl: string | null;
}

export interface Exam408DemoGroup {
  subjectKey: string;
  label: string;
  demos: Exam408DemoSummary[];
}

/** 与专题库 exam_408_subjects.key 对齐的四科展示顺序 */
const SUBJECT_LABELS: Record<string, string> = {
  "beokayy-408/data-structure": "数据结构",
  "beokayy-408/computer-organization": "计算机组成原理",
  "beokayy-408/operating-system": "操作系统",
  "beokayy-408/computer-network": "计算机网络",
};

const SUBJECT_ORDER = Object.keys(SUBJECT_LABELS);

export function exam408DemoSubjectLabel(subjectKey: string): string {
  const known = SUBJECT_LABELS[subjectKey];
  if (known) return known;
  const tail = subjectKey.split("/").filter(Boolean).at(-1) ?? subjectKey;
  return tail.replace(/[-_]+/g, " ").toUpperCase();
}

export function groupExam408Demos(demos: Exam408DemoSummary[]): Exam408DemoGroup[] {
  const groups = new Map<string, Exam408DemoGroup>();
  for (const demo of demos) {
    const group = groups.get(demo.subjectKey) ?? {
      subjectKey: demo.subjectKey,
      label: exam408DemoSubjectLabel(demo.subjectKey),
      demos: [],
    };
    group.demos.push(demo);
    groups.set(demo.subjectKey, group);
  }
  const rank = (subjectKey: string) => {
    const index = SUBJECT_ORDER.indexOf(subjectKey);
    return index === -1 ? SUBJECT_ORDER.length : index;
  };
  return [...groups.values()].sort(
    (left, right) => rank(left.subjectKey) - rank(right.subjectKey) || left.subjectKey.localeCompare(right.subjectKey),
  );
}

const MAX_FRAME_LENGTH = 200;

/** 帧路径归一化：只接受 http(s) 或 /content-demos/…；脏数据一律丢弃 */
export function normalizeDemoStepFrame(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > MAX_FRAME_LENGTH) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return /^https?:\/\//i.test(raw) ? raw : null;
  }
  let path = raw.replace(/^\.?\//, "");
  if (path.startsWith("public/")) path = path.slice("public/".length);
  if (!path.startsWith("content-demos/")) return null;
  const normalized = `/${path}`;
  if (/[<>"\s]/.test(normalized)) return null;
  return normalized;
}

export function normalizeDemoSteps(value: unknown): Exam408DemoStep[] {
  if (!Array.isArray(value)) return [];
  const steps: Exam408DemoStep[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const explain = typeof record.explain === "string" ? record.explain.trim() : "";
    const frame = normalizeDemoStepFrame(record.frame);
    if (!explain && !frame) continue;
    steps.push({ explain, frame });
  }
  return steps;
}

/** 相对帧路径 → 移动端可加载的绝对 URL（API 域名 + 站点根路径） */
export function resolveExam408DemoFrame(frame: string | null): string | null {
  const path = normalizeDemoStepFrame(frame);
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return getApiUrl().replace(/\/+$/, "") + path;
}

export async function getExam408Demos(): Promise<Exam408DemoSummary[]> {
  const payload = await request<{ list?: Exam408DemoSummary[] }>("/api/exam/408/demos");
  return (payload.list ?? []).map((demo) => ({
    ...demo,
    description: demo.description ?? "",
    frameCount: Number(demo.frameCount ?? 0),
    stepsCount: Number(demo.stepsCount ?? 0),
    knowledgePointKey: demo.knowledgePointKey ?? null,
  }));
}

export async function getExam408Demo(key: string): Promise<Exam408DemoDetail> {
  const payload = await request<{ demo: Exam408DemoDetail }>(
    `/api/exam/408/demos?key=${encodeURIComponent(key)}`,
  );
  const demo = payload.demo;
  return {
    ...demo,
    description: demo.description ?? "",
    steps: normalizeDemoSteps(demo.steps),
    frameCount: Number(demo.frameCount ?? 0),
    knowledgePointKey: demo.knowledgePointKey ?? null,
    sourceUrl: demo.sourceUrl ?? null,
  };
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
