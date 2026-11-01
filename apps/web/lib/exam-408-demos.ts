import { pgPool } from "@/lib/db";

/**
 * 408 交互演示（408card.top 逐帧镜像，迁移 087）。
 *
 * 数据契约（App/Web 共用）：
 * - 列表：GET /api/exam/408/demos → { list: Exam408DemoSummary[] }
 * - 详情：GET /api/exam/408/demos?key=<demoKey> → { demo: Exam408DemoDetail }
 *
 * frame 是 public/content-demos/<demo>/<n>.webp 的相对路径；抓取同事可能写入
 * "public/content-demos/…" 或带前导斜杠，这里统一归一化成站点根路径 /content-demos/…。
 * assets 尚未抓取时 frame 可能为 null（纯文字步骤），播放器要有占位态。
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
  /** 与知识点互链（详情页可用）；列表契约同名字段，详情额外返回便于直达 */
  knowledgePointKey: string | null;
  /** 来源快照 base_url（408card.top）；缺失时为 null */
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

/** subject_key → 中文科目名；未知 key 退化成末段大写，避免目录出现空白标题 */
export function exam408DemoSubjectLabel(subjectKey: string): string {
  const known = SUBJECT_LABELS[subjectKey];
  if (known) return known;
  const tail = subjectKey.split("/").filter(Boolean).at(-1) ?? subjectKey;
  return tail.replace(/[-_]+/g, " ").toUpperCase();
}

/** 目录按四科固定顺序分组，未知科目按 key 排后面 */
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

/**
 * 帧路径归一化：只接受 http(s) 或 /content-demos/… 两类，其余（协议伪链接、外部路径）一律 null，
 * 避免把库里的脏数据直接塞进 img src。
 */
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

/** 服务端 steps 可能缺失/带脏项：归一化成 [{explain, frame}] 并丢掉空步骤 */
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

interface DemoListRow {
  key: string;
  subject_key: string;
  title: string;
  description: string | null;
  frame_count: number;
  steps_count: number;
  knowledge_point_key: string | null;
}

export async function getExam408Demos(): Promise<Exam408DemoSummary[]> {
  const { rows } = await pgPool.query<DemoListRow>(
    `SELECT
       key,
       subject_key,
       title,
       description,
       frame_count,
       COALESCE(jsonb_array_length(steps), 0) AS steps_count,
       knowledge_point_key
     FROM exam_408_demos
     WHERE status = 'published'
     ORDER BY subject_key, sort_order, key`,
  );
  return rows.map((row) => ({
    key: row.key,
    subjectKey: row.subject_key,
    title: row.title,
    description: row.description ?? "",
    frameCount: Number(row.frame_count),
    stepsCount: Number(row.steps_count),
    knowledgePointKey: row.knowledge_point_key,
  }));
}

interface DemoDetailRow {
  key: string;
  subject_key: string;
  title: string;
  description: string | null;
  steps: unknown;
  frame_count: number;
  knowledge_point_key: string | null;
  source_base_url: string | null;
}

export async function getExam408Demo(key: string): Promise<Exam408DemoDetail | null> {
  const { rows } = await pgPool.query<DemoDetailRow>(
    `SELECT
       d.key,
       d.subject_key,
       d.title,
       d.description,
       d.steps,
       d.frame_count,
       d.knowledge_point_key,
       s.base_url AS source_base_url
     FROM exam_408_demos d
     LEFT JOIN exam_408_source_snapshots s ON s.key = d.source_key
     WHERE d.key = $1 AND d.status = 'published'`,
    [key],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    key: row.key,
    subjectKey: row.subject_key,
    title: row.title,
    description: row.description ?? "",
    steps: normalizeDemoSteps(row.steps),
    frameCount: Number(row.frame_count),
    knowledgePointKey: row.knowledge_point_key,
    sourceUrl: row.source_base_url,
  };
}
