import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { DEFAULT_RESUME_SECTION_ORDER, getResumeTemplate } from "@learn-workbench/shared";

const SELECT_COLS = `id, title, template_key AS "templateKey", is_default AS "isDefault",
  updated_at AS "updatedAt"`;

/** GET /api/resumes —— 当前作用域的简历文档列表（轻量） */
export async function GET() {
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid]);
  const { rows } = await pgPool.query(
    `SELECT ${SELECT_COLS} FROM resume_documents
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND deleted_at IS NULL
      ORDER BY is_default DESC, updated_at DESC, id DESC`,
    w.params
  );
  return NextResponse.json({ documents: rows });
}

/** POST /api/resumes —— 新建简历文档（默认模板 classic + 默认分节顺序） */
export async function POST(req: Request) {
  const parsed = await parseBody(req, 256 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const title = String(body.title ?? "").trim().slice(0, 120) || "我的简历";
  const templateKey = getResumeTemplate(typeof body.templateKey === "string" ? body.templateKey : null).key;
  const sectionOrder = DEFAULT_RESUME_SECTION_ORDER;
  const styles = typeof body.styles === "object" && body.styles !== null ? body.styles : {};
  const overrides = typeof body.overrides === "object" && body.overrides !== null ? body.overrides : {};
  const clientId = typeof body.clientId === "string" ? body.clientId.trim().slice(0, 200) || null : null;

  const scope = await userScope();
  const cols = `title, template_key, section_order, styles, overrides, client_id`;
  const vals = [title, templateKey, JSON.stringify(sectionOrder), JSON.stringify(styles), JSON.stringify(overrides), clientId];

  let rows;
  if (scope.uid) {
    ({ rows } = await pgPool.query(
      `INSERT INTO resume_documents (user_id, ${cols})
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${SELECT_COLS}`,
      [scope.uid, ...vals]
    ));
  } else {
    ({ rows } = await pgPool.query(
      `INSERT INTO resume_documents (user_id, anon_id, ${cols})
       VALUES (NULL, $1, $2, $3, $4, $5, $6, $7) RETURNING ${SELECT_COLS}`,
      [scope.anonId, ...vals]
    ));
  }
  return NextResponse.json({ document: rows[0] }, { status: 201 });
}