import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";

export const KIND_LABELS: Record<string, string> = {
  career: "职业成长",
  language: "语言学习",
  sports: "运动训练",
  hobby: "兴趣技能",
  life: "生活成长",
  custom: "自定义",
};

export const DEFAULT_KIND = "custom";
export const DEFAULT_ICON = "compass";
export const DEFAULT_COLOR = "#6366f1";
export const DEFAULT_PHASE_PREFIX = "P";

const DOMAIN_COLUMNS = `career_key, name, description, is_locked, sort_order,
            owner_id, kind, icon, color, phase_prefix, is_archived`;

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
}

export function error(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

export function normalizeColor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim();
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : null;
}

export function normalizePhasePrefix(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return /^[A-Za-z0-9]{1,3}$/.test(t) ? t.toUpperCase() : null;
}

export function kindOf(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const k = v.trim();
  return k in KIND_LABELS ? k : null;
}

/** 校验一个字段为空时返回错误响应；否则返回 {value, params} 动态片段 */
export function field(
  col: string,
  label: string,
  value: string | null,
  params: unknown[]
): { ok: false; response: NextResponse } | { ok: true; sql: string } {
  if (value === null) {
    return { ok: false, response: error(`${label}不能为空`, 400) };
  }
  params.push(value);
  return { ok: true, sql: `${col} = $${params.length}` };
}

/** careers 是否可见：系统内置（owner_id NULL）或当前用户自建且未归档 */
export async function domainExists(
  key: string,
  uid: string,
  opts: { includeArchived?: boolean } = {}
): Promise<DomainRow | null> {
  const archived = opts.includeArchived ? "" : " AND is_archived = FALSE";
  const { rows } = await pgPool.query<DomainRow>(
    `SELECT ${DOMAIN_COLUMNS} FROM careers
     WHERE career_key = $1 AND (owner_id IS NULL OR owner_id = $2)${archived}`,
    [key, uid]
  );
  return rows[0] ?? null;
}

/** 供 /api/settings/career 校验候选域 key（系统 + 本人自建） */
export async function listSelectableKeys(uid: string): Promise<Set<string>> {
  const { rows } = await pgPool.query<{ career_key: string }>(
    `SELECT career_key FROM careers
     WHERE is_archived = FALSE AND (owner_id IS NULL OR owner_id = $1)`,
    [uid]
  );
  return new Set(rows.map((r) => r.career_key));
}

/** 领域行 → API 响应（含 kind 中文标签） */
export function serializeDomain(row: DomainRow) {
  return {
    career_key: row.career_key,
    name: row.name,
    description: row.description,
    is_locked: row.is_locked,
    sort_order: row.sort_order,
    owner_id: row.owner_id,
    kind: row.kind,
    icon: row.icon,
    color: row.color,
    phase_prefix: row.phase_prefix,
    is_archived: row.is_archived,
    kind_label: KIND_LABELS[row.kind] ?? row.kind,
  };
}
