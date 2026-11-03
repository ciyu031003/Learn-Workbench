import { pgPool } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * B1 · 默认简历回溯/提升（GET 与 DELETE 共用）。
 *
 * 历史问题：两份路由各自持有一份 best-effort UPDATE，且失败一律吞掉；并发下
 * 「都没有默认 → 同时把不同行置默认」会撞部分唯一索引 uq_resume_files_default（23505），
 * 只靠一次尝试等于把失败留给下一次读取。
 *
 * 本实现做两件事：
 *  1. 单条带 CTE 的 UPDATE 完成全部判定与写入（见下方 SQL），是一条语句 = 一个隐式事务；
 *  2. 捕获 23505 后退避重试（10ms / 30ms，最多 3 次尝试），仍失败只记日志并返回 null，
 *     调用方（列表 / 删除）响应不受影响。
 *
 * 为什么单条 SQL 是原子的（而不是「先 SELECT 再 UPDATE」）：
 *  - PostgreSQL 里多语句之间的间隙是并发窗口；把「有没有默认」的判定（NOT EXISTS）、
 *    「挑哪一行」（ORDER BY created_at DESC, id DESC LIMIT 1）和「写 is_default」放进
 *    同一条语句，判定与写入在同一个语句快照内完成，不会出现「判定时无默认、写入时已
 *    有默认」的中间态被另一个请求看到并重复写入；
 *  - 跨事务的最终互斥由部分唯一索引 uq_resume_files_default 保证（同一 user_id 最多
 *    一条 is_default = true 的未删行）。READ COMMITTED 下，若并发事务恰好在语句快照
 *    之后提交了另一条默认，本语句会以 23505 失败 —— 这正是下面的重试要接住的情况，
 *    重试时 NOT EXISTS 已能看到对方已提交的默认，UPDATE 空跑返回 null（幂等）。
 */

/** 最多尝试 3 次（含首次）；每次重试前的退避毫秒数，长度 = 尝试次数 - 1 */
export const RESUME_DEFAULT_MAX_ATTEMPTS = 3;
export const RESUME_DEFAULT_RETRY_DELAYS_MS: readonly number[] = [10, 30];

/**
 * 原子提升语句：
 *  - candidate：该用户未删行里，只有在「一个默认都没有」时才挑最近上传的一份；
 *  - UPDATE 只改 candidate 选中的那一行，RETURNING 给出被提升的 id（对外一律 string，S5-4）；
 *  - 没有任何候选（没有简历 / 已有默认）时 UPDATE 影响 0 行，返回 null。
 */
const ENSURE_DEFAULT_SQL = `WITH candidate AS (
  SELECT id
    FROM resume_files
   WHERE user_id = $1
     AND deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1
         FROM resume_files
        WHERE user_id = $1
          AND deleted_at IS NULL
          AND is_default
     )
   ORDER BY created_at DESC, id DESC
   LIMIT 1
)
UPDATE resume_files
   SET is_default = true
 WHERE id = (SELECT id FROM candidate)
RETURNING id::text AS id`;

/** PostgreSQL 唯一约束冲突（23505）：并发写入撞 uq_resume_files_default */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 保证该用户至多一条默认简历：没有默认时把最近上传的一份提升为默认。
 *
 * @param userId 已通过会话校验的用户 id（查询与写入都按 user_id 过滤）
 * @returns 本次被提升的简历 id（string）；没有可提升的行 / 重试耗尽时返回 null
 *
 * 失败不影响调用方响应：GET 列表照常返回（本次不标记默认，下次读取会再自愈），
 * DELETE 照常返回 ok。绝不向路由抛错。
 */
export async function ensureSingleDefault(userId: string): Promise<string | null> {
  for (let attempt = 0; attempt < RESUME_DEFAULT_MAX_ATTEMPTS; attempt++) {
    try {
      const { rows } = await pgPool.query<{ id: string }>(ENSURE_DEFAULT_SQL, [userId]);
      return rows[0]?.id ?? null;
    } catch (error) {
      const uniqueViolation = isUniqueViolation(error);
      if (uniqueViolation && attempt < RESUME_DEFAULT_MAX_ATTEMPTS - 1) {
        // 并发把默认让给了别人：稍后重试，NOT EXISTS 会看到已提交的默认，本次空跑返回 null
        await sleep(RESUME_DEFAULT_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      logger.error(
        uniqueViolation ? "resume-default: 默认简历回溯唯一冲突重试耗尽，本次跳过" : "resume-default: 默认简历回溯失败",
        error
      );
      return null;
    }
  }
  return null;
}
