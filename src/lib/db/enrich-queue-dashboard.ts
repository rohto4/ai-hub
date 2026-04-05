import { getSql } from '@/lib/db'

type LatestJobRow = {
  job_name: string
  status: 'running' | 'completed' | 'failed'
  started_at: string
  finished_at: string | null
  processed_count: number | string | null
  success_count: number | string | null
  failed_count: number | string | null
  duration_seconds: number | string
  metadata: Record<string, unknown> | null
}

export type EnrichQueueSourceRow = {
  sourceKey: string
  rawTotal: number
  rawProcessed: number
  rawUnprocessed: number
}

export type EnrichQueueJobRow = {
  jobName: string
  scheduleLabel: string
  status: 'running' | 'completed' | 'failed' | 'unknown'
  startedAt: string | null
  finishedAt: string | null
  processedCount: number
  successCount: number
  failedCount: number
  durationSeconds: number
  metadata: Record<string, unknown>
}

export type EnrichQueueRecommendation = {
  id: string
  title: string
  reason: string
  actionKey: AdminEnrichActionKey | null
  actionLabel: string | null
}

export type AdminEnrichActionKey =
  | 'run-hourly-layer12-recovery'
  | 'run-hourly-layer12-8cycles'
  | 'run-enrich-worker'
  | 'run-enrich-arxiv'
  | 'run-hourly-fetch'
  | 'run-publish-and-ranks'

export type EnrichQueueDashboardData = {
  checkedAt: string
  summary: {
    rawUnprocessed: number
    rawDueNow: number
    rawLocked: number
    rawOver24h: number
    rawWithError: number
    manualPending: number
    publishCandidatesReady: number
    currentRunningJobs: number
    estimatedDrainHoursAtScheduledRate: number
    topSourceKey: string | null
    topSourcePending: number
  }
  jobs: EnrichQueueJobRow[]
  topSources: EnrichQueueSourceRow[]
  recommendations: EnrichQueueRecommendation[]
}

const JOB_SCHEDULE_LABEL: Record<string, string> = {
  'hourly-fetch': '毎時 :00',
  'enrich-worker': '毎時 :05〜:40 の 8 回',
  'hourly-publish': '毎時 :50',
  'hourly-compute-ranks': 'publish 後段',
  'daily-tag-dedup': '毎日 02:30 UTC',
  'monthly-public-archive': '毎月 1 日 03:00 UTC',
}

const TRACKED_JOBS = [
  'hourly-fetch',
  'enrich-worker',
  'hourly-publish',
  'hourly-compute-ranks',
  'daily-tag-dedup',
  'monthly-public-archive',
] as const

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

function buildRecommendations(input: {
  rawUnprocessed: number
  rawDueNow: number
  manualPending: number
  publishCandidatesReady: number
  topSourceKey: string | null
  topSourcePending: number
  jobs: EnrichQueueJobRow[]
}): EnrichQueueRecommendation[] {
  const recommendations: EnrichQueueRecommendation[] = []
  const latestEnrich = input.jobs.find((job) => job.jobName === 'enrich-worker')

  if (input.rawDueNow >= 800) {
    recommendations.push({
      id: 'recovery-cycle',
      title: 'まずは 1 サイクルだけ追いつき運転',
      reason: `今すぐ裁ける未処理が ${input.rawDueNow} 件あるため、fetch + enrich を短い 1 サイクルで回して純減するかを先に確認する。`,
      actionKey: 'run-hourly-layer12-recovery',
      actionLabel: '推奨回復を実行',
    })
  }

  if (input.topSourceKey === 'arxiv-ai' && input.topSourcePending >= 300) {
    recommendations.push({
      id: 'arxiv-focus',
      title: '最大 backlog source を別枠で処理',
      reason: `最大 backlog は ${input.topSourceKey} の ${input.topSourcePending} 件で、全体待ち行列を押し上げている。source 指定 enrich で局所的に減らす価値が高い。`,
      actionKey: 'run-enrich-arxiv',
      actionLabel: 'arxiv-ai を 1 回処理',
    })
  }

  if (input.publishCandidatesReady >= 50) {
    recommendations.push({
      id: 'publish-followup',
      title: 'L4 反映待ちをまとめて流す',
      reason: `publish 対象候補が ${input.publishCandidatesReady} 件あるため、enrich 後の見え方確認を優先するなら publish + ranks を続けて回す。`,
      actionKey: 'run-publish-and-ranks',
      actionLabel: 'publish + ranks を実行',
    })
  }

  if (input.manualPending > 0) {
    recommendations.push({
      id: 'manual-pending',
      title: 'manual_pending を別ラインで回収',
      reason: `manual_pending が ${input.manualPending} 件あり、通常 enrich の純減とは別に回収線が必要。現状は artifact と import の手作業前提。`,
      actionKey: null,
      actionLabel: null,
    })
  }

  if (!latestEnrich || latestEnrich.status === 'failed') {
    recommendations.push({
      id: 'enrich-health',
      title: 'enrich-worker の単発実行で現況を再確認',
      reason: '最新の enrich 状態が弱いため、20件設定の標準実行で現況を取り直してから追いつき線の判断をする。',
      actionKey: 'run-enrich-worker',
      actionLabel: '標準 enrich を 1 回実行',
    })
  }

  return recommendations
}

export async function getEnrichQueueDashboardData(): Promise<EnrichQueueDashboardData> {
  const sql = getSql()

  const [
    rawSummaryRow,
    manualPendingRow,
    publishCandidatesRow,
    runningJobsRow,
    topSources,
    latestJobRows,
  ] = await Promise.all([
    (sql`
      SELECT
        COUNT(*) FILTER (WHERE is_processed = false)::int AS raw_unprocessed,
        COUNT(*) FILTER (
          WHERE is_processed = false
            AND (process_after IS NULL OR process_after <= now())
        )::int AS raw_due_now,
        COUNT(*) FILTER (
          WHERE is_processed = false
            AND process_after > now()
        )::int AS raw_locked,
        COUNT(*) FILTER (
          WHERE is_processed = false
            AND created_at <= now() - interval '24 hours'
        )::int AS raw_over_24h,
        COUNT(*) FILTER (WHERE last_error IS NOT NULL)::int AS raw_with_error
      FROM articles_raw
    ` as unknown as Promise<Array<{
      raw_unprocessed: number | string
      raw_due_now: number | string
      raw_locked: number | string
      raw_over_24h: number | string
      raw_with_error: number | string
    }>>).then((rows) => rows[0]),
    (sql`
      SELECT COUNT(*)::int AS manual_pending
      FROM articles_enriched
      WHERE ai_processing_state = 'manual_pending'
    ` as unknown as Promise<Array<{ manual_pending: number | string }>>).then((rows) => rows[0]),
    (sql`
      SELECT COUNT(*)::int AS publish_candidates_ready
      FROM articles_enriched ae
      WHERE ae.publish_candidate = true
        AND ae.dedupe_status = 'unique'
        AND ae.ai_processing_state = 'completed'
        AND COALESCE(ae.commercial_use_policy, 'permitted') != 'prohibited'
    ` as unknown as Promise<Array<{ publish_candidates_ready: number | string }>>).then((rows) => rows[0]),
    (sql`
      SELECT COUNT(*)::int AS current_running_jobs
      FROM job_runs
      WHERE status = 'running'
    ` as unknown as Promise<Array<{ current_running_jobs: number | string }>>).then((rows) => rows[0]),
    sql`
      SELECT
        st.source_key,
        COUNT(*)::int AS raw_total,
        COUNT(*) FILTER (WHERE ar.is_processed = true)::int AS raw_processed,
        COUNT(*) FILTER (WHERE ar.is_processed = false)::int AS raw_unprocessed
      FROM source_targets st
      LEFT JOIN articles_raw ar ON ar.source_target_id = st.source_target_id
      WHERE st.is_active = true
      GROUP BY st.source_key
      ORDER BY raw_unprocessed DESC, raw_total DESC, st.source_key ASC
      LIMIT 12
    ` as unknown as Promise<Array<{
      source_key: string
      raw_total: number | string
      raw_processed: number | string
      raw_unprocessed: number | string
    }>>,
    sql`
      WITH ranked AS (
        SELECT
          job_name,
          status,
          started_at,
          finished_at,
          processed_count,
          success_count,
          failed_count,
          metadata,
          EXTRACT(EPOCH FROM (COALESCE(finished_at, now()) - started_at))::int AS duration_seconds,
          ROW_NUMBER() OVER (PARTITION BY job_name ORDER BY started_at DESC) AS rn
        FROM job_runs
        WHERE job_name = ANY(${TRACKED_JOBS}::text[])
      )
      SELECT
        job_name,
        status,
        started_at,
        finished_at,
        processed_count,
        success_count,
        failed_count,
        metadata,
        duration_seconds
      FROM ranked
      WHERE rn = 1
      ORDER BY started_at DESC
    ` as unknown as Promise<LatestJobRow[]>,
  ])

  const rawUnprocessed = toNumber(rawSummaryRow.raw_unprocessed)
  const rawDueNow = toNumber(rawSummaryRow.raw_due_now)
  const topSource = topSources[0]
  const jobs = TRACKED_JOBS.map((jobName) => {
    const row = latestJobRows.find((job) => job.job_name === jobName)
    const status: EnrichQueueJobRow['status'] =
      row?.status === 'running' || row?.status === 'completed' || row?.status === 'failed'
        ? row.status
        : 'unknown'
    return {
      jobName,
      scheduleLabel: JOB_SCHEDULE_LABEL[jobName] ?? '未定義',
      status,
      startedAt: row?.started_at ?? null,
      finishedAt: row?.finished_at ?? null,
      processedCount: toNumber(row?.processed_count),
      successCount: toNumber(row?.success_count),
      failedCount: toNumber(row?.failed_count),
      durationSeconds: toNumber(row?.duration_seconds),
      metadata: row?.metadata ?? {},
    }
  })

  return {
    checkedAt: new Date().toISOString(),
    summary: {
      rawUnprocessed,
      rawDueNow,
      rawLocked: toNumber(rawSummaryRow.raw_locked),
      rawOver24h: toNumber(rawSummaryRow.raw_over_24h),
      rawWithError: toNumber(rawSummaryRow.raw_with_error),
      manualPending: toNumber(manualPendingRow.manual_pending),
      publishCandidatesReady: toNumber(publishCandidatesRow.publish_candidates_ready),
      currentRunningJobs: toNumber(runningJobsRow.current_running_jobs),
      estimatedDrainHoursAtScheduledRate: Number((rawUnprocessed / 160).toFixed(1)),
      topSourceKey: topSource?.source_key ?? null,
      topSourcePending: toNumber(topSource?.raw_unprocessed),
    },
    jobs,
    topSources: topSources.map((row) => ({
      sourceKey: row.source_key,
      rawTotal: toNumber(row.raw_total),
      rawProcessed: toNumber(row.raw_processed),
      rawUnprocessed: toNumber(row.raw_unprocessed),
    })),
    recommendations: buildRecommendations({
      rawUnprocessed,
      rawDueNow,
      manualPending: toNumber(manualPendingRow.manual_pending),
      publishCandidatesReady: toNumber(publishCandidatesRow.publish_candidates_ready),
      topSourceKey: topSource?.source_key ?? null,
      topSourcePending: toNumber(topSource?.raw_unprocessed),
      jobs,
    }),
  }
}
