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
  live_processed_count: number | string | null
  live_failed_count: number | string | null
  live_skipped_count: number | string | null
}

export type EnrichQueueSourceRow = {
  sourceKey: string
  sourceType: string
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
  liveProcessedCount: number
  liveFailedCount: number
  liveSkippedCount: number
  scheduleRunsPlanned?: number
  scheduleRunsCompleted?: number
  scheduleRunsRunning?: number
  scheduleRunsFailed?: number
}

export type EnrichQueueRecommendation = {
  id: string
  title: string
  reason: string
  actionKey: AdminEnrichActionKey | null
  actionLabel: string | null
}

export type AdminEnrichActionKey =
  | 'run-hourly-layer12-recovery-non-paper'
  | 'run-hourly-layer12-recovery-paper'
  | 'run-hourly-layer12-8cycles-non-paper'
  | 'run-hourly-layer12-8cycles-paper'
  | 'run-enrich-worker-non-paper'
  | 'run-enrich-worker-paper'
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
    rawUnprocessedNonPaper: number
    rawDueNowNonPaper: number
    rawLockedNonPaper: number
    rawOver24hNonPaper: number
    rawUnprocessedPaper: number
    rawDueNowPaper: number
    rawLockedPaper: number
    rawOver24hPaper: number
    rawWithError: number
    manualPending: number
    publishCandidatesPending: number
    currentRunningJobs: number
    paperSharePercent: number
    estimatedDrainHoursAtScheduledRate: number
    estimatedDrainHoursNonPaper: number
    estimatedDrainHoursPaper: number
    topNonPaperSourceKey: string | null
    topNonPaperSourcePending: number
    topPaperSourceKey: string | null
    topPaperSourcePending: number
  }
  jobs: EnrichQueueJobRow[]
  topNonPaperSources: EnrichQueueSourceRow[]
  topPaperSources: EnrichQueueSourceRow[]
  recommendations: EnrichQueueRecommendation[]
}

const JOB_SCHEDULE_LABEL: Record<string, string> = {
  'hourly-fetch': '毎時 :00',
  'enrich-worker': '毎時 :05〜:40 の 8 回 / non-paper',
  'enrich-worker-paper': '同 route / paper 実行',
  'hourly-publish': '毎時 :50',
  'hourly-compute-ranks': 'publish 後段',
  'daily-tag-dedup': '毎日 02:30 UTC',
  'monthly-public-archive': '毎月 1 日 03:00 UTC',
}

const TRACKED_JOBS = [
  'hourly-fetch',
  'enrich-worker',
  'enrich-worker-paper',
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

export function buildRecommendations(input: {
  rawUnprocessed: number
  rawDueNow: number
  rawDueNowNonPaper: number
  manualPending: number
  publishCandidatesPending: number
  paperSharePercent: number
  topNonPaperSourceKey: string | null
  topNonPaperSourcePending: number
  topPaperSourceKey: string | null
  topPaperSourcePending: number
  jobs: EnrichQueueJobRow[]
}): EnrichQueueRecommendation[] {
  const recommendations: EnrichQueueRecommendation[] = []
  const latestEnrich = input.jobs.find((job) => job.jobName === 'enrich-worker')

  if (input.rawDueNowNonPaper >= 800) {
    recommendations.push({
      id: 'recovery-cycle',
      title: 'まずは 1 サイクルだけ追いつき運転',
      reason: `non-paper の今すぐ裁ける未処理が ${input.rawDueNowNonPaper} 件あるため、fetch + enrich を短い 1 サイクルで回して純減するかを先に確認する。`,
      actionKey: 'run-hourly-layer12-recovery-non-paper',
      actionLabel: '推奨回復を実行',
    })
  }

  if (input.paperSharePercent >= 70 && input.rawDueNowNonPaper < 400) {
    recommendations.push({
      id: 'paper-dominant',
      title: 'paper backlog が支配的なので通常運転を優先',
      reason: `未処理の ${input.paperSharePercent}% が paper 系で、non-paper の即時 backlog は ${input.rawDueNowNonPaper} 件です。サイト側の鮮度を見るなら通常運転を維持しつつ、paper は別ラインで減らす判断が妥当です。`,
      actionKey: null,
      actionLabel: null,
    })
  }

  if (input.topPaperSourceKey === 'arxiv-ai' && input.topPaperSourcePending >= 300) {
    recommendations.push({
      id: 'arxiv-focus',
      title: '最大 backlog source を別枠で処理',
      reason: `最大 paper backlog は ${input.topPaperSourceKey} の ${input.topPaperSourcePending} 件で、全体待ち行列を押し上げている。source 指定 enrich で局所的に減らす価値が高い。`,
      actionKey: 'run-enrich-arxiv',
      actionLabel: 'arxiv-ai を 1 回処理',
    })
  }

  if (input.publishCandidatesPending >= 50) {
    recommendations.push({
      id: 'publish-followup',
      title: 'L4 反映待ちをまとめて流す',
      reason: `L4 未反映、または再反映待ちが ${input.publishCandidatesPending} 件あるため、enrich 後の見え方確認を優先するなら publish + ranks を続けて回す。`,
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
      actionKey: 'run-enrich-worker-non-paper',
      actionLabel: 'non-paper enrich を 1 回実行',
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
    topNonPaperSources,
    topPaperSources,
    latestJobRows,
    enrichWindowRow,
  ] = await Promise.all([
    (sql`
      SELECT
        COUNT(*) FILTER (WHERE ar.is_processed = false)::int AS raw_unprocessed,
        COUNT(*) FILTER (
          WHERE ar.is_processed = false
            AND (ar.process_after IS NULL OR ar.process_after <= now())
        )::int AS raw_due_now,
        COUNT(*) FILTER (
          WHERE ar.is_processed = false
            AND ar.process_after > now()
        )::int AS raw_locked,
        COUNT(*) FILTER (
          WHERE ar.is_processed = false
            AND ar.created_at <= now() - interval '24 hours'
        )::int AS raw_over_24h,
        COUNT(*) FILTER (
          WHERE ar.is_processed = false
            AND COALESCE(st.source_type, '') <> 'paper'
        )::int AS raw_unprocessed_non_paper,
        COUNT(*) FILTER (
          WHERE ar.is_processed = false
            AND COALESCE(st.source_type, '') <> 'paper'
            AND (ar.process_after IS NULL OR ar.process_after <= now())
        )::int AS raw_due_now_non_paper,
        COUNT(*) FILTER (
          WHERE ar.is_processed = false
            AND COALESCE(st.source_type, '') <> 'paper'
            AND ar.process_after > now()
        )::int AS raw_locked_non_paper,
        COUNT(*) FILTER (
          WHERE ar.is_processed = false
            AND COALESCE(st.source_type, '') <> 'paper'
            AND ar.created_at <= now() - interval '24 hours'
        )::int AS raw_over_24h_non_paper,
        COUNT(*) FILTER (
          WHERE ar.is_processed = false
            AND st.source_type = 'paper'
        )::int AS raw_unprocessed_paper,
        COUNT(*) FILTER (
          WHERE ar.is_processed = false
            AND st.source_type = 'paper'
            AND (ar.process_after IS NULL OR ar.process_after <= now())
        )::int AS raw_due_now_paper,
        COUNT(*) FILTER (
          WHERE ar.is_processed = false
            AND st.source_type = 'paper'
            AND ar.process_after > now()
        )::int AS raw_locked_paper,
        COUNT(*) FILTER (
          WHERE ar.is_processed = false
            AND st.source_type = 'paper'
            AND ar.created_at <= now() - interval '24 hours'
        )::int AS raw_over_24h_paper,
        COUNT(*) FILTER (WHERE ar.last_error IS NOT NULL)::int AS raw_with_error
      FROM articles_raw ar
      LEFT JOIN source_targets st ON st.source_target_id = ar.source_target_id
    ` as unknown as Promise<Array<{
      raw_unprocessed: number | string
      raw_due_now: number | string
      raw_locked: number | string
      raw_over_24h: number | string
      raw_unprocessed_non_paper: number | string
      raw_due_now_non_paper: number | string
      raw_locked_non_paper: number | string
      raw_over_24h_non_paper: number | string
      raw_unprocessed_paper: number | string
      raw_due_now_paper: number | string
      raw_locked_paper: number | string
      raw_over_24h_paper: number | string
      raw_with_error: number | string
    }>>).then((rows) => rows[0]),
    (sql`
      SELECT COUNT(*)::int AS manual_pending
      FROM articles_enriched
      WHERE ai_processing_state = 'manual_pending'
    ` as unknown as Promise<Array<{ manual_pending: number | string }>>).then((rows) => rows[0]),
    (sql`
      SELECT COUNT(*)::int AS publish_candidates_pending
      FROM articles_enriched ae
      LEFT JOIN public_articles pa
        ON pa.enriched_article_id = ae.enriched_article_id
       AND pa.visibility_status = 'published'
      WHERE ae.publish_candidate = true
        AND ae.dedupe_status = 'unique'
        AND ae.ai_processing_state = 'completed'
        AND COALESCE(ae.commercial_use_policy, 'permitted') != 'prohibited'
        AND (
          pa.public_article_id IS NULL
          OR COALESCE(pa.public_refreshed_at, pa.updated_at, pa.created_at) < ae.updated_at
        )
    ` as unknown as Promise<Array<{ publish_candidates_pending: number | string }>>).then((rows) => rows[0]),
    (sql`
      SELECT COUNT(*)::int AS current_running_jobs
      FROM job_runs
      WHERE status = 'running'
    ` as unknown as Promise<Array<{ current_running_jobs: number | string }>>).then((rows) => rows[0]),
    sql`
      SELECT
        st.source_key,
        COALESCE(st.source_type, 'unknown') AS source_type,
        COUNT(*)::int AS raw_total,
        COUNT(*) FILTER (WHERE ar.is_processed = true)::int AS raw_processed,
        COUNT(*) FILTER (WHERE ar.is_processed = false)::int AS raw_unprocessed
      FROM source_targets st
      LEFT JOIN articles_raw ar ON ar.source_target_id = st.source_target_id
      WHERE st.is_active = true
        AND COALESCE(st.source_type, '') <> 'paper'
      GROUP BY st.source_key, COALESCE(st.source_type, 'unknown')
      ORDER BY raw_unprocessed DESC, raw_total DESC, st.source_key ASC
      LIMIT 12
    ` as unknown as Promise<Array<{
      source_key: string
      source_type: string
      raw_total: number | string
      raw_processed: number | string
      raw_unprocessed: number | string
    }>>,
    sql`
      SELECT
        st.source_key,
        COALESCE(st.source_type, 'unknown') AS source_type,
        COUNT(*)::int AS raw_total,
        COUNT(*) FILTER (WHERE ar.is_processed = true)::int AS raw_processed,
        COUNT(*) FILTER (WHERE ar.is_processed = false)::int AS raw_unprocessed
      FROM source_targets st
      LEFT JOIN articles_raw ar ON ar.source_target_id = st.source_target_id
      WHERE st.is_active = true
        AND st.source_type = 'paper'
      GROUP BY st.source_key, COALESCE(st.source_type, 'unknown')
      ORDER BY raw_unprocessed DESC, raw_total DESC, st.source_key ASC
      LIMIT 12
    ` as unknown as Promise<Array<{
      source_key: string
      source_type: string
      raw_total: number | string
      raw_processed: number | string
      raw_unprocessed: number | string
    }>>,
    sql`
      WITH ranked AS (
        SELECT
          job_run_id,
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
      ),
      item_stats AS (
        SELECT
          job_run_id,
          COUNT(*) FILTER (WHERE item_status = 'processed')::int AS live_processed_count,
          COUNT(*) FILTER (WHERE item_status = 'failed')::int AS live_failed_count,
          COUNT(*) FILTER (WHERE item_status = 'skipped')::int AS live_skipped_count
        FROM job_run_items
        GROUP BY job_run_id
      )
      SELECT
        ranked.job_name,
        ranked.status,
        ranked.started_at,
        ranked.finished_at,
        ranked.processed_count,
        ranked.success_count,
        ranked.failed_count,
        ranked.metadata,
        ranked.duration_seconds,
        COALESCE(item_stats.live_processed_count, 0) AS live_processed_count,
        COALESCE(item_stats.live_failed_count, 0) AS live_failed_count,
        COALESCE(item_stats.live_skipped_count, 0) AS live_skipped_count
      FROM ranked
      LEFT JOIN item_stats ON item_stats.job_run_id = ranked.job_run_id
      WHERE rn = 1
      ORDER BY ranked.started_at DESC
    ` as unknown as Promise<LatestJobRow[]>,
    sql`
      SELECT
        job_name,
        COUNT(*)::int AS planned_runs,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_runs,
        COUNT(*) FILTER (WHERE status = 'running')::int AS running_runs,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_runs
      FROM job_runs
      WHERE job_name = ANY(${['enrich-worker', 'enrich-worker-paper']}::text[])
        AND started_at >= date_trunc('hour', now())
      GROUP BY job_name
    ` as unknown as Promise<Array<{
      job_name: string
      planned_runs: number | string
      completed_runs: number | string
      running_runs: number | string
      failed_runs: number | string
    }>>,
  ])

  const rawUnprocessed = toNumber(rawSummaryRow.raw_unprocessed)
  const rawDueNow = toNumber(rawSummaryRow.raw_due_now)
  const rawUnprocessedNonPaper = toNumber(rawSummaryRow.raw_unprocessed_non_paper)
  const rawUnprocessedPaper = toNumber(rawSummaryRow.raw_unprocessed_paper)
  const topNonPaperSource = topNonPaperSources[0]
  const topPaperSource = topPaperSources[0]
  const enrichWindowByJob = new Map(enrichWindowRow.map((row) => [row.job_name, row]))
  const jobs = TRACKED_JOBS.map((jobName) => {
    const row = latestJobRows.find((job) => job.job_name === jobName)
    const status: EnrichQueueJobRow['status'] =
      row?.status === 'running' || row?.status === 'completed' || row?.status === 'failed'
        ? row.status
        : 'unknown'
    const baseJob: EnrichQueueJobRow = {
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
      liveProcessedCount: toNumber(row?.live_processed_count),
      liveFailedCount: toNumber(row?.live_failed_count),
      liveSkippedCount: toNumber(row?.live_skipped_count),
    }

    if (jobName === 'enrich-worker' || jobName === 'enrich-worker-paper') {
      const enrichWindow = enrichWindowByJob.get(jobName)
      baseJob.scheduleRunsPlanned = jobName === 'enrich-worker' ? 8 : toNumber(enrichWindow?.planned_runs)
      baseJob.scheduleRunsCompleted = toNumber(enrichWindow?.completed_runs)
      baseJob.scheduleRunsRunning = toNumber(enrichWindow?.running_runs)
      baseJob.scheduleRunsFailed = toNumber(enrichWindow?.failed_runs)
    }

    return baseJob
  })

  return {
    checkedAt: new Date().toISOString(),
    summary: {
      rawUnprocessed,
      rawDueNow,
      rawLocked: toNumber(rawSummaryRow.raw_locked),
      rawOver24h: toNumber(rawSummaryRow.raw_over_24h),
      rawUnprocessedNonPaper,
      rawDueNowNonPaper: toNumber(rawSummaryRow.raw_due_now_non_paper),
      rawLockedNonPaper: toNumber(rawSummaryRow.raw_locked_non_paper),
      rawOver24hNonPaper: toNumber(rawSummaryRow.raw_over_24h_non_paper),
      rawUnprocessedPaper,
      rawDueNowPaper: toNumber(rawSummaryRow.raw_due_now_paper),
      rawLockedPaper: toNumber(rawSummaryRow.raw_locked_paper),
      rawOver24hPaper: toNumber(rawSummaryRow.raw_over_24h_paper),
      rawWithError: toNumber(rawSummaryRow.raw_with_error),
      manualPending: toNumber(manualPendingRow.manual_pending),
      publishCandidatesPending: toNumber(publishCandidatesRow.publish_candidates_pending),
      currentRunningJobs: toNumber(runningJobsRow.current_running_jobs),
      paperSharePercent:
        rawUnprocessed > 0 ? Number(((rawUnprocessedPaper / rawUnprocessed) * 100).toFixed(1)) : 0,
      estimatedDrainHoursAtScheduledRate: Number((rawUnprocessed / 160).toFixed(1)),
      estimatedDrainHoursNonPaper: Number((rawUnprocessedNonPaper / 160).toFixed(1)),
      estimatedDrainHoursPaper: Number((rawUnprocessedPaper / 160).toFixed(1)),
      topNonPaperSourceKey: topNonPaperSource?.source_key ?? null,
      topNonPaperSourcePending: toNumber(topNonPaperSource?.raw_unprocessed),
      topPaperSourceKey: topPaperSource?.source_key ?? null,
      topPaperSourcePending: toNumber(topPaperSource?.raw_unprocessed),
    },
    jobs,
    topNonPaperSources: topNonPaperSources.map((row) => ({
      sourceKey: row.source_key,
      sourceType: row.source_type,
      rawTotal: toNumber(row.raw_total),
      rawProcessed: toNumber(row.raw_processed),
      rawUnprocessed: toNumber(row.raw_unprocessed),
    })),
    topPaperSources: topPaperSources.map((row) => ({
      sourceKey: row.source_key,
      sourceType: row.source_type,
      rawTotal: toNumber(row.raw_total),
      rawProcessed: toNumber(row.raw_processed),
      rawUnprocessed: toNumber(row.raw_unprocessed),
    })),
    recommendations: buildRecommendations({
      rawUnprocessed,
      rawDueNow,
      rawDueNowNonPaper: toNumber(rawSummaryRow.raw_due_now_non_paper),
      manualPending: toNumber(manualPendingRow.manual_pending),
      publishCandidatesPending: toNumber(publishCandidatesRow.publish_candidates_pending),
      paperSharePercent:
        rawUnprocessed > 0 ? Number(((rawUnprocessedPaper / rawUnprocessed) * 100).toFixed(1)) : 0,
      topNonPaperSourceKey: topNonPaperSource?.source_key ?? null,
      topNonPaperSourcePending: toNumber(topNonPaperSource?.raw_unprocessed),
      topPaperSourceKey: topPaperSource?.source_key ?? null,
      topPaperSourcePending: toNumber(topPaperSource?.raw_unprocessed),
      jobs,
    }),
  }
}
