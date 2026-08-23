import { pgPool } from "@/lib/db";
import type { ExamEvent } from "@learn-workbench/shared";

export async function listUpcomingExamEvents(limit = 30): Promise<ExamEvent[]> {
  const { rows } = await pgPool.query(
    `SELECT e.id, e.job_id, e.kind, e.label, e.event_at, e.note,
            j.title, j.source, j.url
       FROM job_exam_events e
       JOIN job_postings j ON j.id = e.job_id
      WHERE e.event_at >= now() - interval '1 day'
      ORDER BY e.event_at ASC
      LIMIT $1`,
    [limit]
  );
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    jobId: r.job_id,
    kind: r.kind,
    label: r.label,
    eventAt: new Date(r.event_at).toISOString(),
    note: r.note ?? "",
    daysLeft: Math.max(0, Math.round((new Date(r.event_at).getTime() - now) / 86400000)),
    title: r.title ?? "",
    source: r.source ?? "",
    url: r.url ?? "",
  }));
}
