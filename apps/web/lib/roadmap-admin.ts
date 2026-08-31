import type { PoolClient } from "pg";
import { pgPool } from "@/lib/db";

export type RoadmapTrack = "main" | "agent";

/**
 * 对某职业路线的某个轨道重排 sort_order（0..N-1）并重写 phase_key：
 *  - main：ict → phase-1..N；其他职业 → <career>-phase-1..N
 *  - agent：单阶段保持 agent-track；多阶段 → <career>-agent-1..N
 * phase_key 全局唯一，故带职业前缀避免跨职业冲突。
 *
 * 可选 order 传入显式新顺序（如拖拽排序后的 id 数组）；不传则按当前 sort_order, id 归一。
 *
 * 两步更新避免 (career_key, track, sort_order) 与 phase_key 唯一约束中间态冲突：
 *  1) 该轨道全部先置为临时值（sort_order = -(sort+1) 负数、phase_key = 'ren-'||id）
 *  2) 再按序写入最终 sort_order 与 phase_key
 */
export async function renumberTrack(
  careerKey: string,
  track: RoadmapTrack,
  tx?: PoolClient,
  order?: number[]
): Promise<void> {
  const run = async (c: PoolClient) => {
    await c.query(
      `UPDATE content_phases SET sort_order = -(sort_order + 1), phase_key = 'ren-' || id
       WHERE career_key = $1 AND track = $2`,
      [careerKey, track]
    );
    let ids: number[];
    if (order) {
      ids = order;
    } else {
      const { rows } = await c.query<{ id: number }>(
        `SELECT id FROM content_phases
         WHERE career_key = $1 AND track = $2
         ORDER BY sort_order, id`,
        [careerKey, track]
      );
      ids = rows.map((r) => r.id);
    }
    for (let i = 0; i < ids.length; i++) {
      const phaseKey =
        track === "main"
          ? careerKey === "ict"
            ? `phase-${i + 1}`
            : `${careerKey}-phase-${i + 1}`
          : ids.length === 1
            ? "agent-track"
            : `${careerKey}-agent-${i + 1}`;
      await c.query(
        `UPDATE content_phases SET phase_key = $1, sort_order = $2 WHERE id = $3`,
        [phaseKey, i, ids[i]]
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