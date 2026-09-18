import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-error";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { parseBody } from "@/lib/http";
import { MD_ROADMAP_LIMITS, countParsed, parseRoadmapMarkdown } from "@/lib/roadmap-markdown";

/**
 * POST /api/roadmap/import —— Markdown 学习计划批量导入（v6 P3-2）
 *
 * body: { markdown: string, career?: string, dryRun?: boolean }
 *   markdown  H1=阶段 / H2=主题 / H3=主题内学习内容条目（正文进 content_md）
 *   career    省略时用用户当前领域（settings.career → ict）
 *   dryRun    true 只解析返回预览树，不写库（客户端「预览」按钮用）
 *
 * 幂等/隔离：写入的实体全部 is_custom=TRUE + owner_id=uid + import_batch_id；
 * 事务内逐级插入（阶段 → 主题 → 条目），任何一步失败整体回滚。
 */

/** 用户当前学习领域（settings.career，缺省 ict） */
async function resolveCareer(uid: string): Promise<string> {
  const { rows } = await pgPool.query<{ value: unknown }>(
    `SELECT value FROM settings WHERE user_id = $1 AND key = 'career'`,
    [uid]
  );
  const v = rows[0]?.value;
  return typeof v === "string" && v.trim() ? v.trim() : "ict";
}

export async function POST(req: Request) {
  try {
    const uid = await currentUserId();
    if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const parsed = await parseBody(req, 512 * 1024);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    const body = (parsed.data ?? {}) as Record<string, unknown>;

    const markdown = typeof body.markdown === "string" ? body.markdown : "";
    if (!markdown.trim()) return NextResponse.json({ error: "Markdown 内容为空" }, { status: 400 });
    const careerRaw = typeof body.career === "string" ? body.career.trim().slice(0, 60) : "";
    const dryRun = body.dryRun === true;

    const phases = parseRoadmapMarkdown(markdown);
    const counts = countParsed(phases);
    if (counts.phases === 0) {
      return NextResponse.json({ error: "没有解析到标题：请用 # 阶段 / ## 主题 / ### 学习内容" }, { status: 400 });
    }
    const over =
      counts.phases > MD_ROADMAP_LIMITS.maxPhases ||
      counts.topics > MD_ROADMAP_LIMITS.maxTopics ||
      counts.items > MD_ROADMAP_LIMITS.maxItems;
    if (over) {
      return NextResponse.json(
        { error: `内容过大：阶段 ${counts.phases}/${MD_ROADMAP_LIMITS.maxPhases}、主题 ${counts.topics}/${MD_ROADMAP_LIMITS.maxTopics}、条目 ${counts.items}/${MD_ROADMAP_LIMITS.maxItems}` },
        { status: 400 }
      );
    }

    const career = careerRaw || (await resolveCareer(uid));
    const domain = await pgPool.query<{ owner_id: string | null }>(
      `SELECT owner_id FROM careers WHERE career_key = $1 AND is_archived = FALSE`,
      [career]
    );
    if (!domain.rows[0]) return NextResponse.json({ error: "学习领域不存在" }, { status: 400 });
    if (domain.rows[0].owner_id !== null && domain.rows[0].owner_id !== uid) {
      return NextResponse.json({ error: "无权写入他人自定义领域" }, { status: 403 });
    }

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, career, preview: phases, counts });
    }

    const batchId = `md-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      const { rows: nextRows } = await client.query<{ next: number }>(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM content_phases WHERE career_key = $1 AND track = 'main'`,
        [career]
      );
      let sortOrder = Number(nextRows[0]?.next ?? 0);
      let topicCount = 0;
      let itemCount = 0;

      for (const phase of phases) {
        const { rows: phaseRows } = await client.query<{ id: number }>(
          `INSERT INTO content_phases
             (phase_key, career_key, title, summary, track, sort_order, is_custom, owner_id, import_batch_id)
           VALUES ('custom-' || gen_random_uuid(), $1, $2, $3, 'main', $4, TRUE, $5, $6)
           RETURNING id`,
          [career, phase.title, phase.summary, sortOrder, uid, batchId]
        );
        sortOrder += 1;
        const phaseId = phaseRows[0].id;
        let topicOrder = 0;
        for (const topic of phase.topics) {
          const { rows: topicRows } = await client.query<{ id: number }>(
            `INSERT INTO content_topics
               (phase_id, topic_key, title, summary, sort_order, is_custom, owner_id, import_batch_id)
             VALUES ($1, 'md-' || gen_random_uuid(), $2, $3, $4, TRUE, $5, $6)
             RETURNING id`,
            [phaseId, topic.title, topic.summary, topicOrder, uid, batchId]
          );
          topicOrder += 1;
          topicCount += 1;
          const topicId = topicRows[0].id;
          let itemOrder = 0;
          for (const item of topic.items) {
            await client.query(
              `INSERT INTO content_topic_items (topic_id, title, content_md, sort_order) VALUES ($1, $2, $3, $4)`,
              [topicId, item.title, item.contentMd, itemOrder]
            );
            itemOrder += 1;
            itemCount += 1;
          }
        }
      }
      await client.query("COMMIT");
      return NextResponse.json(
        { ok: true, career, batchId, created: { phases: phases.length, topics: topicCount, items: itemCount } },
        { status: 201 }
      );
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    return dbErrorResponse(e);
  }
}
