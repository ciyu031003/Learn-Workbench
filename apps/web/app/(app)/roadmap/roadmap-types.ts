/** roadmap 页共享类型/常量（S6-1 拆分：page / hooks / view 三处复用，避免循环依赖） */

export type Track = "main" | "agent";

export interface DomainRow {
  career_key: string;
  name: string;
  description: string | null;
  is_locked: boolean;
  sort_order: number;
  owner_id: string | null;
  kind: string;
  icon: string;
  color: string;
  phase_prefix: string;
  is_archived: boolean;
  kind_label: string;
}

export interface DomainTemplate {
  key: string;
  name: string;
  kindLabel: string;
  icon: string;
  color: string;
  phasePrefix: string;
  description: string;
  weeksNote: string | null;
  phaseCount: number;
}

export interface MdCounts {
  phases: number;
  topics: number;
  items: number;
}

export interface MdTopicPreview {
  title: string;
  summary: string | null;
  items: { title: string; contentMd: string }[];
}

export interface MdPhasePreview {
  title: string;
  summary: string | null;
  topics: MdTopicPreview[];
}

export interface MdImportResponse {
  ok?: boolean;
  dryRun?: boolean;
  career?: string;
  counts?: MdCounts;
  preview?: MdPhasePreview[];
  created?: MdCounts;
  error?: string;
}

export interface DomainEditForm {
  name: string;
  description: string;
  icon: string;
  color: string;
  phasePrefix: string;
  kind: string;
}

export interface PhaseForm {
  track: Track;
  title: string;
  summary: string;
  weeks: string;
}

export const KIND_OPTIONS = [
  { value: "career", label: "职业成长" },
  { value: "language", label: "语言学习" },
  { value: "sports", label: "运动训练" },
  { value: "hobby", label: "兴趣技能" },
  { value: "life", label: "生活成长" },
  { value: "custom", label: "自定义" },
];

export const DOMAIN_COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#16a34a",
  "#9333ea",
  "#e11d48",
  "#ea580c",
  "#f59e0b",
  "#2563eb",
  "#6366f1",
];
