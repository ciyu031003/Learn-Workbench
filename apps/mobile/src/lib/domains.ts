import { Ionicons } from "@expo/vector-icons";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import type { DomainKind } from "@learn-workbench/shared";

type IoniconName = keyof typeof Ionicons.glyphMap;

/** 3.0 学习领域客户端（对齐 Web /api/domains 线上契约，snake_case 字段） */
function authHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = useAppStore.getState().token;
  if (token) headers.Authorization = "Bearer " + token;
  return headers;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

export interface DomainItem {
  career_key: string;
  name: string;
  description: string | null;
  is_locked: boolean;
  sort_order: number;
  owner_id: string | null;
  kind: DomainKind | string;
  icon: string;
  color: string;
  phase_prefix: string;
  is_archived: boolean;
  kind_label?: string;
}

export interface DomainTemplateItem {
  key: string;
  name: string;
  kind: DomainKind | string;
  kindLabel: string;
  icon: string;
  color: string;
  phasePrefix: string;
  description: string;
  weeksNote?: string | null;
  phaseCount: number;
}

export interface DomainListResponse {
  domains: DomainItem[];
  templates?: DomainTemplateItem[];
}

export const DOMAIN_KIND_LABELS: Record<string, string> = {
  career: "职业成长",
  language: "语言学习",
  sports: "运动训练",
  hobby: "兴趣技能",
  life: "生活成长",
  custom: "自定义",
};

/** 领域 icon → Ionicons 名（对齐 Web domain-icon.tsx 的 lucide 语义词表） */
export const DOMAIN_ICON_IONICONS: Record<string, IoniconName> = {
  cpu: "hardware-chip-outline",
  layout: "grid-outline",
  coffee: "cafe-outline",
  "chart-line": "trending-up-outline",
  brain: "bulb-outline",
  shield: "shield-checkmark-outline",
  compass: "compass-outline",
  languages: "language-outline",
  activity: "pulse-outline",
  dribbble: "american-football-outline",
  dumbbell: "barbell-outline",
  "book-open": "book-outline",
};

export function domainIconName(icon?: string | null): IoniconName {
  return (icon && DOMAIN_ICON_IONICONS[icon]) || "compass-outline";
}

export async function fetchDomains(
  opts: { templates?: boolean; archived?: boolean } = {}
): Promise<DomainListResponse> {
  const params = new URLSearchParams();
  if (opts.templates) params.set("templates", "1");
  if (opts.archived) params.set("archived", "1");
  const query = params.toString();
  const response = await fetch(getApiUrl() + "/api/domains" + (query ? "?" + query : ""), {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await readError(response, "学习领域加载失败"));
  return (await response.json()) as DomainListResponse;
}

export interface CreateDomainInput {
  template?: string;
  name?: string;
  description?: string;
}

export async function createDomain(input: CreateDomainInput): Promise<DomainItem> {
  const response = await fetch(getApiUrl() + "/api/domains", {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response, "创建领域失败"));
  const data = (await response.json()) as { domain: DomainItem };
  return data.domain;
}

export interface UpdateDomainInput {
  key: string;
  name?: string;
  description?: string;
  icon?: string;
  kind?: string;
  color?: string;
  phasePrefix?: string;
  isArchived?: boolean;
}

export async function updateDomain(input: UpdateDomainInput): Promise<DomainItem> {
  const response = await fetch(getApiUrl() + "/api/domains", {
    method: "PATCH",
    headers: authHeaders(true),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response, "更新领域失败"));
  const data = (await response.json()) as { domain: DomainItem };
  return data.domain;
}

export function archiveDomain(key: string): Promise<DomainItem> {
  return updateDomain({ key, isArchived: true });
}

export function restoreDomain(key: string): Promise<DomainItem> {
  return updateDomain({ key, isArchived: false });
}

export async function deleteDomain(key: string): Promise<void> {
  const response = await fetch(getApiUrl() + "/api/domains?key=" + encodeURIComponent(key), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await readError(response, "删除领域失败"));
}
