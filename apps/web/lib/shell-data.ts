import { currentUser } from "@/lib/session";
import { pgPool } from "@/lib/db";
import { KIND_LABELS } from "@/app/api/domains/lib";

/**
 * 应用外壳的服务端取数（S6-2）。
 *
 * 原来 AppShell 在客户端挂载后再请求 /api/domains、/api/settings/career、/api/summary、
 * /api/auth/me（其中 /api/summary 还是整页聚合，最贵）。现在改成：
 *   (app)/layout.tsx（Server Component）→ getShellData() → <AppShell shellData={...}>
 * 首屏只带 HTML/RSC，不再有这些壳层 XHR；传给客户端组件的**只有纯数据**（无函数/类实例）。
 *
 * 本文件只服务端使用：不要从客户端组件 import（会把 pg 拖进浏览器包）。
 */

export interface ShellUser {
  id: string;
  username: string;
  displayName: string | null;
}

export interface ShellDomain {
  careerKey: string;
  name: string;
  color: string;
  icon: string;
  kindLabel: string;
  isLocked: boolean;
}

export interface ShellData {
  user: ShellUser;
  domains: ShellDomain[];
  /** 当前职业 key（settings.career，缺省 ict） */
  currentCareer: string;
  /** 当前职业的整体完成度（0–100） */
  overallPercent: number;
  /** 下载页地址（NEXT_PUBLIC_DOWNLOAD_URL；未配置为 null → 导航隐藏下载入口） */
  downloadUrl: string | null;
}

/** 只接受 http(s) 绝对地址；空/非法 → null（导航据此隐藏下载入口） */
export function resolveDownloadUrl(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/**
 * 读取下载地址环境变量。
 * 用**动态键**读 env：既支持运行时注入（compose/PM2），也避免客户端构建期把地址写死；
 * 优先 NEXT_PUBLIC_DOWNLOAD_URL，兼容旧的 DOWNLOAD_URL。
 */
export function downloadUrlFromEnv(env: Record<string, string | undefined> = process.env): string | null {
  return resolveDownloadUrl(env["NEXT_PUBLIC_DOWNLOAD_URL"] ?? env["DOWNLOAD_URL"]);
}

interface DomainRow {
  career_key: string;
  name: string;
  kind: string;
  icon: string | null;
  color: string | null;
  is_locked: boolean;
}

/** 外壳数据（未登录返回 null，由 layout 重定向） */
export async function getShellData(): Promise<ShellData | null> {
  const user = await currentUser().catch(() => null);
  if (!user) return null;

  const domains: ShellDomain[] = await pgPool
    .query<DomainRow>(
      `SELECT career_key, name, kind, icon, color, is_locked
         FROM careers
        WHERE is_archived = FALSE AND (owner_id IS NULL OR owner_id = $1)
        ORDER BY sort_order, id`,
      [user.id]
    )
    .then((r) =>
      r.rows.map((row) => ({
        careerKey: row.career_key,
        name: row.name,
        color: row.color ?? "#6366f1",
        icon: row.icon ?? "compass",
        kindLabel: KIND_LABELS[row.kind] ?? row.kind,
        isLocked: Boolean(row.is_locked),
      }))
    )
    .catch(() => []);

  const currentCareer = await pgPool
    .query<{ value: unknown }>(`SELECT value FROM settings WHERE user_id = $1 AND key = 'career'`, [user.id])
    .then((r) => (r.rows[0]?.value ? String(r.rows[0].value) : "ict"))
    .catch(() => "ict");

  const overallPercent = await pgPool
    .query<{ total: number; done: number }>(
      `WITH t AS (
         SELECT id FROM content_topics
          WHERE (is_custom = FALSE OR owner_id = $1)
            AND phase_id IN (SELECT id FROM content_phases WHERE career_key = $2)
       )
       SELECT (SELECT count(*)::int FROM t) AS total,
              (SELECT count(*)::int FROM topic_progress p
                 JOIN t ON t.id = p.topic_id
                WHERE p.user_id = $1 AND p.done = TRUE) AS done`,
      [user.id, currentCareer]
    )
    .then((r) => {
      const total = Number(r.rows[0]?.total ?? 0);
      const done = Number(r.rows[0]?.done ?? 0);
      return total > 0 ? Math.round((done / total) * 100) : 0;
    })
    .catch(() => 0);

  return {
    user: { id: user.id, username: user.username, displayName: user.displayName },
    domains,
    currentCareer,
    overallPercent,
    downloadUrl: downloadUrlFromEnv(),
  };
}
