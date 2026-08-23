import { pgPool } from "@/lib/db";
import type { JobNotification, JobSubscription } from "@learn-workbench/shared";

export async function listSubscriptions(userId: string): Promise<JobSubscription[]> {
  const { rows } = await pgPool.query(
    `SELECT id, name, categories, keywords, cities, enabled, created_at
       FROM job_subscriptions WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    categories: Array.isArray(r.categories) ? r.categories : [],
    keywords: Array.isArray(r.keywords) ? r.keywords.map(String) : [],
    cities: Array.isArray(r.cities) ? r.cities.map(String) : [],
    enabled: !!r.enabled,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
export async function saveSubscription(
  userId: string,
  sub: Omit<JobSubscription, "id" | "createdAt"> & { id?: number }
): Promise<JobSubscription> {
  const name = (sub.name || "").trim() || "我的订阅";
  const categories = Array.isArray(sub.categories) ? sub.categories : [];
  const keywords = Array.isArray(sub.keywords) ? sub.keywords : [];
  const cities = Array.isArray(sub.cities) ? sub.cities : [];
  const { rows } = await pgPool.query(
    `INSERT INTO job_subscriptions (id, user_id, name, categories, keywords, cities, enabled)
     VALUES (COALESCE($1, nextval('job_subscriptions_id_seq'::regclass)), $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, categories = EXCLUDED.categories, keywords = EXCLUDED.keywords,
       cities = EXCLUDED.cities, enabled = EXCLUDED.enabled, updated_at = now()
     RETURNING id, name, categories, keywords, cities, enabled, created_at`,
    [sub.id ?? null, userId, name, JSON.stringify(categories), JSON.stringify(keywords), JSON.stringify(cities), sub.enabled]
  );
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    categories: Array.isArray(r.categories) ? r.categories : [],
    keywords: Array.isArray(r.keywords) ? r.keywords.map(String) : [],
    cities: Array.isArray(r.cities) ? r.cities.map(String) : [],
    enabled: !!r.enabled,
    createdAt: new Date(r.created_at).toISOString(),
  };
}
export async function deleteSubscription(userId: string, id: number): Promise<boolean> {
  const { rowCount } = await pgPool.query(
    "DELETE FROM job_subscriptions WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}
export async function listNotifications(userId: string, unreadOnly = false, limit = 30): Promise<JobNotification[]> {
  const args: unknown[] = [userId, limit];
  let where = "user_id = $1";
  if (unreadOnly) where += " AND read_at IS NULL";
  const { rows } = await pgPool.query(
    `SELECT id, job_id, subscription_id, title, body, url, read_at, created_at
       FROM job_notifications
      WHERE ${where}
      ORDER BY created_at DESC LIMIT $2`,
    args
  );
  return rows.map((r) => ({
    id: r.id,
    jobId: r.job_id,
    subscriptionId: r.subscription_id ?? null,
    title: r.title,
    body: r.body ?? "",
    url: r.url ?? "",
    read: !!r.read_at,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
export async function unreadNotificationCount(userId: string): Promise<number> {
  const { rows } = await pgPool.query(
    "SELECT count(*)::int AS n FROM job_notifications WHERE user_id = $1 AND read_at IS NULL",
    [userId]
  );
  return rows[0]?.n ?? 0;
}
export async function markNotificationRead(userId: string, id: number): Promise<void> {
  await pgPool.query(
    "UPDATE job_notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL",
    [id, userId]
  );
}
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await pgPool.query(
    "UPDATE job_notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL",
    [userId]
  );
}
