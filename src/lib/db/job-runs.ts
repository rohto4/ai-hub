import { getSql } from '@/lib/db'

export type JobRunStatus = 'running' | 'completed' | 'failed'
export type JobRunItemStatus = 'processed' | 'failed' | 'skipped'

export interface StartJobRunInput {
  jobName: string
  metadata?: Record<string, unknown>
}

export interface FinishJobRunInput {
  jobRunId: number
  status: JobRunStatus
  processedCount: number
  successCount: number
  failedCount: number
  metadata?: Record<string, unknown>
  lastError?: string | null
}

export interface JobRunItemInput {
  jobRunId: number
  itemKey: string
  itemStatus: JobRunItemStatus
  detail?: Record<string, unknown>
  errorMessage?: string | null
}

export async function startJobRun(input: StartJobRunInput): Promise<number> {
  const sql = getSql()
  const rows = (await sql`
    INSERT INTO job_runs (job_name, status, metadata)
    VALUES (${input.jobName}, 'running', ${JSON.stringify(input.metadata ?? {})}::jsonb)
    RETURNING id
  `) as Array<{ id: number }>

  return rows[0].id
}

export async function recordJobRunItem(input: JobRunItemInput): Promise<void> {
  const sql = getSql()
  await sql`
    INSERT INTO job_run_items (job_run_id, item_key, item_status, detail, error_message)
    VALUES (
      ${input.jobRunId},
      ${input.itemKey},
      ${input.itemStatus},
      ${JSON.stringify(input.detail ?? {})}::jsonb,
      ${input.errorMessage ?? null}
    )
  `
}

export async function finishJobRun(input: FinishJobRunInput): Promise<void> {
  const sql = getSql()
  await sql`
    UPDATE job_runs
    SET
      status = ${input.status},
      finished_at = now(),
      processed_count = ${input.processedCount},
      success_count = ${input.successCount},
      failed_count = ${input.failedCount},
      metadata = ${JSON.stringify(input.metadata ?? {})}::jsonb,
      last_error = ${input.lastError ?? null},
      updated_at = now()
    WHERE id = ${input.jobRunId}
  `
}
