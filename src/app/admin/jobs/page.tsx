import { AdminJobsClient } from '@/components/admin/AdminJobsClient'
import { getSql, isDatabaseConfigured } from '@/lib/db'

async function fetchRecentRuns() {
  if (!isDatabaseConfigured()) return []
  const sql = getSql()
  const runs = (await sql`
    SELECT
      job_run_id AS id, job_name, status, started_at, finished_at,
      processed_count, success_count, failed_count,
      metadata, last_error,
      EXTRACT(EPOCH FROM (COALESCE(finished_at, now()) - started_at))::int AS duration_seconds
    FROM job_runs
    ORDER BY started_at DESC
    LIMIT 50
  `) as Array<{
    id: string | number
    job_name: string
    status: string
    started_at: string
    finished_at: string | null
    processed_count: number | string
    success_count: number | string
    failed_count: number | string
    metadata: Record<string, unknown>
    last_error: string | null
    duration_seconds: number | string
  }>

  return runs.map((r) => ({
    id: Number(r.id),
    jobName: r.job_name,
    status: r.status as 'running' | 'completed' | 'failed',
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    processedCount: Number(r.processed_count),
    successCount: Number(r.success_count),
    failedCount: Number(r.failed_count),
    durationSeconds: Number(r.duration_seconds),
    metadata: r.metadata as Record<string, unknown>,
    lastError: r.last_error,
  }))
}

export default async function AdminJobsPage() {
  const runs = await fetchRecentRuns()
  return <AdminJobsClient initialRuns={runs} />
}
