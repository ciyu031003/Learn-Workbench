/**
 * 阅读体验状态（组二 · 阶段 8 = V3 纵轨 Phase B）。
 *
 * 三件事：
 *   1. `recordReadState`：打开/读完知识点 → 记一次阅读（进度只增不减，重复读不降 first_read_at）；
 *   2. `setFavorite`：收藏/取消收藏（软删除，可再次收藏，历史行保留）；
 *   3. `learningLibraryState`：跨设备拉取（Web 上看得到手机上读过的、收藏的）。
 *
 * 为什么不做成"只增不改"的 append-only 事件流：阅读状态是**幂等的最新态**（在哪儿、读到几成），
 * 每次上报都覆盖前一次才符合直觉；需要事件级轨迹时用 `learning_attempts` 那套（作答本来就是事件）。
 */
import {
  type LearningFavorite,
  type LearningLibraryState,
  type LearningReadState,
} from "@learn-workbench/shared";
import { pgPool } from "@/lib/db";

/** 近 7 天算"本周在读" */
export const READ_WEEK_DAYS = 7;

interface ReadRow {
  point_key: string;
  track_slug: string;
  stage_key: string;
  topic_key: string;
  first_read_at: string;
  last_read_at: string;
  progress: number;
  read_count: number;
}

function toReadState(row: ReadRow): LearningReadState {
  return {
    pointKey: String(row.point_key),
    trackSlug: String(row.track_slug),
    stageKey: String(row.stage_key),
    topicKey: String(row.topic_key),
    firstReadAt: new Date(row.first_read_at).toISOString(),
    lastReadAt: new Date(row.last_read_at).toISOString(),
    progress: Number(row.progress),
    readCount: Number(row.read_count),
  };
}

/** 纯函数：状态计数（"本周在读"按注入的 now 计算，便于测试）。 */
export function summarizeLibraryState(
  read: LearningReadState[],
  favorites: LearningFavorite[],
  now: Date = new Date()
): LearningLibraryState["counts"] {
  const threshold = now.getTime() - READ_WEEK_DAYS * 86_400_000;
  return {
    read: read.length,
    favorites: favorites.length,
    readThisWeek: read.filter((item) => Date.parse(item.lastReadAt) >= threshold).length,
  };
}

export async function recordReadState(
  userId: string,
  input: { pointKey: string; trackSlug: string; stageKey: string; topicKey: string; progress?: number; clientId?: string }
): Promise<LearningReadState> {
  const { rows } = await pgPool.query<ReadRow>(
    `INSERT INTO knowledge_read_state
       (user_id, point_key, track_slug, stage_key, topic_key, progress, client_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, point_key) DO UPDATE SET
       track_slug = EXCLUDED.track_slug,
       stage_key = EXCLUDED.stage_key,
       topic_key = EXCLUDED.topic_key,
       -- 进度只增不减：回看前文不应把"读到 90%"打回 20%
       progress = GREATEST(knowledge_read_state.progress, EXCLUDED.progress),
       read_count = knowledge_read_state.read_count + 1,
       last_read_at = now(),
       client_id = EXCLUDED.client_id,
       updated_at = now()
     RETURNING point_key, track_slug, stage_key, topic_key, first_read_at, last_read_at, progress, read_count`,
    [
      userId,
      input.pointKey,
      input.trackSlug,
      input.stageKey,
      input.topicKey,
      Math.max(0, Math.min(100, Math.round(input.progress ?? 0))),
      input.clientId ?? null,
    ]
  );
  return toReadState(rows[0]);
}

export interface FavoriteResult {
  pointKey: string;
  favorite: boolean;
  changed: boolean;
}

export async function setFavorite(
  userId: string,
  input: { pointKey: string; trackSlug: string; stageKey: string; topicKey: string; favorite: boolean; note?: string }
): Promise<FavoriteResult> {
  if (input.favorite) {
    const { rowCount } = await pgPool.query(
      `INSERT INTO knowledge_favorites (user_id, point_key, track_slug, stage_key, topic_key, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, point_key) WHERE deleted_at IS NULL
       DO UPDATE SET note = EXCLUDED.note, updated_at = now()`,
      [userId, input.pointKey, input.trackSlug, input.stageKey, input.topicKey, input.note ?? null]
    );
    return { pointKey: input.pointKey, favorite: true, changed: (rowCount ?? 0) > 0 };
  }
  const { rowCount } = await pgPool.query(
    `UPDATE knowledge_favorites SET deleted_at = now(), updated_at = now()
      WHERE user_id = $1 AND point_key = $2 AND deleted_at IS NULL`,
    [userId, input.pointKey]
  );
  return { pointKey: input.pointKey, favorite: false, changed: (rowCount ?? 0) > 0 };
}

/** 跨设备拉取：某课程（可缺省=全部）的阅读状态 + 收藏。 */
export async function learningLibraryState(
  userId: string,
  trackSlug?: string,
  now: Date = new Date()
): Promise<LearningLibraryState> {
  const params: unknown[] = [userId];
  let readWhere = "WHERE user_id = $1";
  let favoriteWhere = "WHERE user_id = $1 AND deleted_at IS NULL";
  if (trackSlug) {
    params.push(trackSlug);
    readWhere += ` AND track_slug = $${params.length}`;
    favoriteWhere += ` AND track_slug = $${params.length}`;
  }
  const { rows: readRows } = await pgPool.query<ReadRow>(
    `SELECT point_key, track_slug, stage_key, topic_key, first_read_at, last_read_at, progress, read_count
       FROM knowledge_read_state
       ${readWhere}
      ORDER BY last_read_at DESC`,
    params
  );
  const { rows: favoriteRows } = await pgPool.query<{
    point_key: string;
    track_slug: string;
    stage_key: string;
    topic_key: string;
    note: string | null;
    created_at: string;
  }>(
    `SELECT point_key, track_slug, stage_key, topic_key, note, created_at
       FROM knowledge_favorites
       ${favoriteWhere}
      ORDER BY created_at DESC`,
    params
  );
  const read = readRows.map(toReadState);
  const favorites: LearningFavorite[] = favoriteRows.map((row) => ({
    pointKey: String(row.point_key),
    trackSlug: String(row.track_slug),
    stageKey: String(row.stage_key),
    topicKey: String(row.topic_key),
    note: row.note === null ? null : String(row.note),
    createdAt: new Date(row.created_at).toISOString(),
  }));
  return { read, favorites, counts: summarizeLibraryState(read, favorites, now) };
}
