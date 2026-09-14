import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { assembleResumeContent, parseSectionOrder, parseStyles } from "@/lib/resume";
import { getResumeTemplate } from "@learn-workbench/shared";

const DOC_COLS = `id, title, template_key AS "templateKey", section_order AS "sectionOrder",
  styles, overrides, is_default AS "isDefault", updated_at AS "updatedAt"`;

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** GET /api/resumes/[id] —— 文档配置 + 实时组装的内容（Profile/证书/技能/资产） */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  const { rows } = await pgPool.query(
    `SELECT ${DOC_COLS} FROM resume_documents
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2 AND deleted_at IS NULL`,
    w.params
  );
  const doc = rows[0];
  if (!doc) return NextResponse.json({ error: "未找到简历" }, { status: 404 });

  const content = await assembleResumeContent(scope);
  const templateKey = String(doc.templateKey ?? "classic");
  return NextResponse.json({
    document: {
      ...doc,
      templateKey,
      sectionOrder: parseSectionOrder(doc.sectionOrder),
      styles: parseStyles(templateKey, doc.styles),
    },
    content,
  });
}

/** PATCH /api/resumes/[id] —— 更新标题/模板/分节顺序/样式/覆盖 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const parsed = await parseBody(req, 256 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  const sets: string[] = [];
  const params: unknown[] = [...w.params];
  const push = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };

  if (body.title !== undefined) {
    const title = String(body.title).trim().slice(0, 120);
    if (!title) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    push("title", title);
  }
  if (body.templateKey !== undefined) {
    const key = typeof body.templateKey === "string" ? body.templateKey : "";
    const tpl = getResumeTemplate(key);
    if (tpl.key !== key) return NextResponse.json({ error: "模板不存在" }, { status: 400 });
    push("template_key", tpl.key);
  }
  if (body.sectionOrder !== undefined) {
    push("section_order", JSON.stringify(parseSectionOrder(body.sectionOrder)));
  }
  if (body.styles !== undefined) {
    if (typeof body.styles !== "object" || body.styles === null) {
      return NextResponse.json({ error: "styles 无效" }, { status: 400 });
    }
    push("styles", JSON.stringify(body.styles));
  }
  if (body.overrides !== undefined) {
    if (typeof body.overrides !== "object" || body.overrides === null) {
      return NextResponse.json({ error: "overrides 无效" }, { status: 400 });
    }
    push("overrides", JSON.stringify(body.overrides));
  }
  if (body.isDefault !== undefined) push("is_default", Boolean(body.isDefault));

  if (sets.length === 0) return NextResponse.json({ error: "没有要更新的字段" }, { status: 400 });

  const { rows } = await pgPool.query(
    `UPDATE resume_documents SET ${sets.join(", ")}, updated_at = now()
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2 AND deleted_at IS NULL
      RETURNING ${DOC_COLS}`,
    params
  );
  const doc = rows[0];
  if (!doc) return NextResponse.json({ error: "未找到简历" }, { status: 404 });
  const templateKey = String(doc.templateKey ?? "classic");
  return NextResponse.json({
    document: { ...doc, sectionOrder: parseSectionOrder(doc.sectionOrder), styles: parseStyles(templateKey, doc.styles) },
  });
}

/** DELETE /api/resumes/[id] —— 软删除 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  await pgPool.query(
    `UPDATE resume_documents SET deleted_at = now()
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2`,
    w.params
  );
  return NextResponse.json({ ok: true });
}