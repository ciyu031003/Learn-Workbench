import type { PoolClient } from "pg";
import { pgPool } from "@/lib/db";

export type RoadmapTrack = "main" | "agent";

/**
 * 对某职业路线的某个轨道重新编号并重排：
 *  - main：phase-1 .. phase-N（P1/P2/...）
 *  - agent：单阶段保持 agent-track，多阶段 agent-1 .. agent-N
 * 同时把 sort_order 归一为 0..N-1。
 *
 * 两步更新避免 phase_key / (career_key, track, sort_order) 唯一约束冲突：
 *  1) 全部先打临时标记（key = ren-<id>，sort = id，均全局唯一）
 *  2) 再按序写入最终 key 与 sort_order
 */
export async function renumberTrack(
  careerKey: string,
  track: RoadmapTrack,
  tx?: PoolClient
): Promise<void> {
  const run = async (c: PoolClient) => {
    const { rows } = await c.query<{ id: number }>(
      `SELECT id FROM content_phases
       WHERE career_key = $1 AND track = $2
       ORDER BY sort_order, id`,
      [careerKey, track]
    );
    for (const row of rows) {
      await c.query(
        `UPDATE content_phases SET phase_key = 'ren-' || id, sort_order = id WHERE id = $1`,
        [row.id]
      );
    }
    for (let i = 0; i < rows.length; i++) {
      const phaseKey =
        track === "main"
          ? `phase-${i + 1}`
          : rows.length === 1
            ? "agent-track"
            : `agent-${i + 1}`;
      await c.query(
        `UPDATE content_phases SET phase_key = $1, sort_order = $2 WHERE id = $3`,
        [phaseKey, i, rows[i].id]
      );
    }
  };

  if (tx) {
    await run(tx);
    return;
  }
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    await run(client);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}