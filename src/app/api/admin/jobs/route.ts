import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSecret } from '@/lib/auth/admin'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { isDatabaseConfigured, getSql } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse()

  const sql = getSql()
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '50')
  const jobName = request.nextUrl.searchParams.get('job') ?? null

  const runs = (await sql`
    SELECT
      job_run_id AS id, job_name, status, started_at, finished_at,
      processed_count, success_count, failed_count,
      metadata, last_error,
      EXTRACT(EPOCH FROM (COALESCE(finished_at, now()) - started_at))::int AS duration_seconds
    FROM job_runs
    WHERE (${jobName}::text IS NULL OR job_name = ${jobName})
    ORDER BY started_at DESC
    LIMIT ${limit}
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

  return NextResponse.json({
    runs: runs.map((r) => ({
      id: Number(r.id),
      jobName: r.job_name,
      status: r.status,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      processedCount: Number(r.processed_count),
      successCount: Number(r.success_count),
      failedCount: Number(r.failed_count),
      durationSeconds: Number(r.duration_seconds),
      metadata: r.metadata,
      lastError: r.last_error,
    })),
  })
}
