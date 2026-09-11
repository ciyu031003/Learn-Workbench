import { pgPool } from "@/lib/db";
import type { MarketIntelligenceFilters } from "./intelligence";

export interface MarketSavedView {
  id: number;
  name: string;
  filters: MarketIntelligenceFilters;
  createdAt: string;
  updatedAt: string;
}

function mapFilters(value: unknown): MarketIntelligenceFilters {
  if (!value || typeof value !== "object") return {};
  const filters = value as Record<string, unknown>;
  const numberOrUndefined = (field: string) => {
    const parsed = Number(filters[field]);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const rangeValue = filters.range;
  const range = rangeValue === 7 || rangeValue === 30 || rangeValue === 90 ? rangeValue : 90;
  return {
    q: typeof filters.q === "string" ? filters.q : undefined,
    city: typeof filters.city === "string" ? filters.city : undefined,
    functionKey: typeof filters.functionKey === "string" ? filters.functionKey : undefined,
    industrySector: typeof filters.industrySector === "string" ? filters.industrySector : undefined,
    industrySubsector: typeof filters.industrySubsector === "string" ? filters.industrySubsector : undefined,
    seniorityBucket: typeof filters.seniorityBucket === "string" ? filters.seniorityBucket : undefined,
    source: typeof filters.source === "string" ? filters.source : undefined,
    salaryMin: numberOrUndefined("salaryMin"),
    salaryMax: numberOrUndefined("salaryMax"),
    range,
  };
}

function sanitizeName(name: string) {
  return name.trim().slice(0, 80);
}

export async function listMarketSavedViews(userId: string): Promise<MarketSavedView[]> {
  const { rows } = await pgPool.query<{
    id: number;
    name: string;
    filters: unknown;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, name, filters, created_at, updated_at
       FROM market_saved_views
      WHERE user_id = $1
      ORDER BY updated_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    filters: mapFilters(row.filters),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

export async function createMarketSavedView(
  userId: string,
  name: string,
  filters: MarketIntelligenceFilters
): Promise<MarketSavedView> {
  const cleanName = sanitizeName(name);
  if (!cleanName) throw new Error("视图名称不能为空");
  const { rows } = await pgPool.query<{
    id: number;
    name: string;
    filters: unknown;
    created_at: Date;
    updated_at: Date;
  }>(
    `INSERT INTO market_saved_views (user_id, name, filters)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (user_id, name)
     DO UPDATE SET filters = EXCLUDED.filters, updated_at = now()
     RETURNING id, name, filters, created_at, updated_at`,
    [userId, cleanName, JSON.stringify(filters)]
  );
  const row = rows[0];
  return {
    id: Number(row.id),
    name: row.name,
    filters: mapFilters(row.filters),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function renameMarketSavedView(
  userId: string,
  viewId: number,
  name: string
): Promise<MarketSavedView | null> {
  const cleanName = sanitizeName(name);
  if (!cleanName) throw new Error("视图名称不能为空");
  const { rows } = await pgPool.query<{
    id: number;
    name: string;
    filters: unknown;
    created_at: Date;
    updated_at: Date;
  }>(
    `UPDATE market_saved_views
        SET name = $3, updated_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING id, name, filters, created_at, updated_at`,
    [viewId, userId, cleanName]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name,
    filters: mapFilters(row.filters),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function updateMarketSavedViewFilters(
  userId: string,
  viewId: number,
  filters: MarketIntelligenceFilters
): Promise<MarketSavedView | null> {
  const { rows } = await pgPool.query<{
    id: number;
    name: string;
    filters: unknown;
    created_at: Date;
    updated_at: Date;
  }>(
    `UPDATE market_saved_views
        SET filters = $3::jsonb, updated_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING id, name, filters, created_at, updated_at`,
    [viewId, userId, JSON.stringify(filters)]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name,
    filters: mapFilters(row.filters),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function deleteMarketSavedView(userId: string, viewId: number): Promise<boolean> {
  const { rowCount } = await pgPool.query(
    `DELETE FROM market_saved_views WHERE id = $1 AND user_id = $2`,
    [viewId, userId]
  );
  return Boolean(rowCount);
}
