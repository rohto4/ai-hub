'use client'

import { useState, useTransition } from 'react'
import { getAdminApiPath } from '@/lib/admin-path'
import type {
  AdminEnrichActionKey,
  EnrichQueueDashboardData,
  EnrichQueueJobRow,
  EnrichQueueRecommendation,
  EnrichQueueSourceRow,
} from '@/lib/db/enrich-queue-dashboard'

function getAdminSecret(): string {
  return typeof window !== 'undefined' ? (localStorage.getItem('admin_secret') ?? '') : ''
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminSecret()}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

function formatDateTime(value: string | null): string {
  if (!value) return '未実行'
  return new Date(value).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatEndLabel(job: EnrichQueueJobRow): string {
  if (job.finishedAt) return formatDateTime(job.finishedAt)
  if (job.status === 'running') return '進行中'
  return '未実行'
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '-'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remain = seconds % 60
  return `${minutes}m ${remain}s`
}

function JobRow({ job }: { job: EnrichQueueJobRow }) {
  const effectiveProcessedCount =
    job.status === 'running'
      ? Math.max(job.processedCount, job.liveProcessedCount + job.liveFailedCount + job.liveSkippedCount)
      : job.processedCount

  const progressLabel =
    job.status === 'running' && effectiveProcessedCount > 0
      ? `途中経過 ${effectiveProcessedCount}`
      : job.status === 'running'
        ? '応答待ち'
        : null

  const enrichScheduleLabel =
    job.jobName === 'enrich-worker' &&
    typeof job.scheduleRunsCompleted === 'number' &&
    typeof job.scheduleRunsPlanned === 'number'
      ? `${job.scheduleRunsCompleted}/${job.scheduleRunsPlanned} 回完了`
      : null

  const statusStyle =
    job.status === 'completed'
      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
      : job.status === 'failed'
        ? 'bg-red-950 text-red-300 border-red-800'
        : job.status === 'running'
          ? 'bg-amber-950 text-amber-300 border-amber-800'
          : 'bg-slate-900 text-slate-400 border-slate-800'

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-white">{job.jobName}</p>
          <p className="mt-1 text-[11px] text-slate-400">{job.scheduleLabel}</p>
          {enrichScheduleLabel ? (
            <p className="mt-1 text-[11px] text-cyan-300">
              {enrichScheduleLabel}
              {job.scheduleRunsRunning ? ` / 実行中 ${job.scheduleRunsRunning}` : ''}
              {job.scheduleRunsFailed ? ` / 失敗 ${job.scheduleRunsFailed}` : ''}
            </p>
          ) : null}
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusStyle}`}>
          {job.status}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-300 md:grid-cols-4">
        <div>
          <p className="text-slate-500">開始</p>
          <p>{formatDateTime(job.startedAt)}</p>
        </div>
        <div>
          <p className="text-slate-500">終了</p>
          <p>{formatEndLabel(job)}</p>
        </div>
        <div>
          <p className="text-slate-500">処理</p>
          <p>{effectiveProcessedCount}</p>
          {progressLabel ? <p className="mt-1 text-[11px] text-cyan-300">{progressLabel}</p> : null}
        </div>
        <div>
          <p className="text-slate-500">所要時間</p>
          <p>{formatDuration(job.durationSeconds)}</p>
        </div>
      </div>
    </div>
  )
}

function SourceRow({ row }: { row: EnrichQueueSourceRow }) {
  return (
    <tr className="border-t border-slate-800 text-xs text-slate-200">
      <td className="px-2 py-1.5 font-mono text-[11px] text-sky-300">{row.sourceKey}</td>
      <td className="px-2 py-1.5 text-[11px] text-slate-500">{row.sourceType}</td>
      <td className="px-2 py-1.5 text-right">{row.rawUnprocessed}</td>
      <td className="px-2 py-1.5 text-right text-slate-400">{row.rawProcessed}</td>
      <td className="px-2 py-1.5 text-right text-slate-500">{row.rawTotal}</td>
    </tr>
  )
}

function actionLabel(key: AdminEnrichActionKey): string {
  switch (key) {
    case 'run-hourly-layer12-recovery-non-paper':
      return 'non-paper 回復を実行'
    case 'run-hourly-layer12-recovery-paper':
      return 'paper 回復を実行'
    case 'run-hourly-layer12-8cycles-non-paper':
      return 'non-paper 8サイクル回復'
    case 'run-hourly-layer12-8cycles-paper':
      return 'paper 8サイクル回復'
    case 'run-enrich-worker-non-paper':
      return 'non-paper enrich を 1 回実行'
    case 'run-enrich-worker-paper':
      return 'paper enrich を 1 回実行'
    case 'run-enrich-arxiv':
      return 'arxiv-ai を 1 回処理'
    case 'run-hourly-fetch':
      return 'fetch を 1 回実行'
    case 'run-publish-and-ranks':
      return 'publish + ranks を実行'
  }
}

function RecommendationCard({
  item,
  onRun,
  busyAction,
}: {
  item: EnrichQueueRecommendation
  onRun: (action: AdminEnrichActionKey) => void
  busyAction: AdminEnrichActionKey | null
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs font-semibold text-white">{item.title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-300">{item.reason}</p>
      {item.actionKey && item.actionLabel ? (
        <button
          onClick={() => onRun(item.actionKey!)}
          disabled={busyAction !== null}
          className="mt-3 rounded-full bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyAction === item.actionKey ? '実行中...' : item.actionLabel}
        </button>
      ) : (
        <p className="mt-3 text-[11px] text-amber-300">この項目は現状ボタン実行なしです</p>
      )}
    </div>
  )
}

export function AdminEnrichQueueClient({
  initialData,
}: {
  initialData: EnrichQueueDashboardData
}) {
  const [data, setData] = useState(initialData)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<AdminEnrichActionKey | null>(null)
  const [isPending, startTransition] = useTransition()

  const refresh = () => {
    startTransition(async () => {
      setError(null)
      try {
        const next = await apiFetch<EnrichQueueDashboardData>(getAdminApiPath('/enrich-queue'))
        setData(next)
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '更新に失敗しました')
      }
    })
  }

  const runAction = async (action: AdminEnrichActionKey) => {
    setBusyAction(action)
    setError(null)
    setLastResult(null)
    try {
      const response = await apiFetch<{
        ok: boolean
        action: AdminEnrichActionKey
        result: unknown
        data: EnrichQueueDashboardData
      }>(getAdminApiPath('/enrich-queue'), {
        method: 'POST',
        body: JSON.stringify({ action }),
      })
      setData(response.data)
      setLastResult(`${actionLabel(action)} を実行しました`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '実行に失敗しました')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-[-0.03em] text-white">Enrich Queue Ops</h1>
          <p className="mt-1 text-xs text-slate-400">
            DB で裁くべき backlog、現在のジョブ状態、推奨フォロープラン、即時実行を 1 画面で確認します。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-slate-500">checked: {formatDateTime(data.checkedAt)}</p>
          <button
            onClick={refresh}
            disabled={isPending || busyAction !== null}
            className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? '更新中...' : '更新'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-300">{error}</div>
      ) : null}
      {lastResult ? (
        <div className="rounded-2xl border border-emerald-800 bg-emerald-950/60 px-4 py-3 text-sm text-emerald-300">{lastResult}</div>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-[0.8fr_1fr_1fr]">
        <QueueSection
          eyebrow="Global"
          title="全体サマリ"
          description="raw 全体と補助タスクの状態です。lane ごとの判断前に全体像だけを確認します。"
          accent="slate"
        >
          <div className="grid gap-2">
            <SummaryStat
              label="全 backlog"
              value={data.summary.rawUnprocessed}
              note={`今すぐ ${data.summary.rawDueNow} / 24h 超 ${data.summary.rawOver24h} / error ${data.summary.rawWithError}`}
            />
            <SummaryStat
              label="補助タスク"
              value={`${data.summary.manualPending} / ${data.summary.publishCandidatesPending}`}
              note={`manual_pending / publish 未反映 / running jobs ${data.summary.currentRunningJobs}`}
            />
            <SummaryStat
              label="全体解消時間"
              value={`${data.summary.estimatedDrainHoursAtScheduledRate}h`}
              note="160件/時の単純計算"
            />
          </div>
        </QueueSection>

        <QueueSection
          eyebrow="Non-paper"
          title="NON-PAPER ステータス"
          description="サイトの鮮度に直結する通常記事の待ち行列です。"
          accent="cyan"
        >
          <div className="grid gap-2 md:grid-cols-2">
            <SummaryStat
              label="通常 backlog"
              value={data.summary.rawUnprocessedNonPaper}
              note={`今すぐ ${data.summary.rawDueNowNonPaper} / ロック中 ${data.summary.rawLockedNonPaper}`}
              accent="cyan"
            />
            <SummaryStat
              label="通常解消時間"
              value={`${data.summary.estimatedDrainHoursNonPaper}h`}
              note={`24h 超 ${data.summary.rawOver24hNonPaper} / total ${data.summary.estimatedDrainHoursAtScheduledRate}h`}
              accent="cyan"
            />
          </div>
          <div className="mt-3 rounded-2xl border border-cyan-900/70 bg-slate-950/70 p-3 text-xs text-slate-300">
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">Largest Non-paper Source</p>
            <p className="mt-1 font-mono text-sm text-white">{data.summary.topNonPaperSourceKey ?? 'n/a'}</p>
            <p className="mt-1 text-slate-400">pending {data.summary.topNonPaperSourcePending}</p>
          </div>
          <div className="mt-3 grid gap-2">
            {([
              'run-enrich-worker-non-paper',
              'run-hourly-layer12-recovery-non-paper',
              'run-hourly-layer12-8cycles-non-paper',
            ] as const).map((action) => (
              <button
                key={action}
                onClick={() => runAction(action)}
                disabled={busyAction !== null}
                className="rounded-xl border border-cyan-900/50 bg-slate-900/80 px-3 py-2 text-left text-xs text-slate-100 transition hover:border-cyan-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === action ? '実行中...' : actionLabel(action)}
              </button>
            ))}
          </div>
        </QueueSection>

        <QueueSection
          eyebrow="Paper"
          title="PAPER ステータス"
          description="研究系 backlog を通常記事と分けて監視します。"
          accent="amber"
        >
          <div className="grid gap-2 md:grid-cols-2">
            <SummaryStat
              label="paper backlog"
              value={data.summary.rawUnprocessedPaper}
              note={`今すぐ ${data.summary.rawDueNowPaper} / ロック中 ${data.summary.rawLockedPaper}`}
              accent="amber"
            />
            <SummaryStat
              label="paper 比率"
              value={`${data.summary.paperSharePercent}%`}
              note={`全 backlog ${data.summary.rawUnprocessed} 件中 / 解消 ${data.summary.estimatedDrainHoursPaper}h`}
              accent="amber"
            />
          </div>
          <div className="mt-3 rounded-2xl border border-amber-900/70 bg-slate-950/70 p-3 text-xs text-slate-300">
            <p className="text-[11px] uppercase tracking-[0.24em] text-amber-300">Largest Paper Source</p>
            <p className="mt-1 font-mono text-sm text-white">{data.summary.topPaperSourceKey ?? 'n/a'}</p>
            <p className="mt-1 text-slate-400">pending {data.summary.topPaperSourcePending}</p>
          </div>
          <div className="mt-3 grid gap-2">
            {([
              'run-enrich-worker-paper',
              'run-hourly-layer12-recovery-paper',
              'run-hourly-layer12-8cycles-paper',
              'run-enrich-arxiv',
            ] as const).map((action) => (
              <button
                key={action}
                onClick={() => runAction(action)}
                disabled={busyAction !== null}
                className="rounded-xl border border-amber-900/50 bg-slate-900/80 px-3 py-2 text-left text-xs text-slate-100 transition hover:border-amber-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === action ? '実行中...' : actionLabel(action)}
              </button>
            ))}
          </div>
        </QueueSection>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <h2 className="text-sm font-bold text-white">現在のジョブ稼働状況</h2>
        <p className="mt-1 text-xs text-slate-400">schedule と最新実行を同じ面で見ます。</p>
        <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-4">
          {data.jobs.map((job) => (
            <JobRow key={job.jobName} job={job} />
          ))}
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <QueueSection
          eyebrow="Normal Sources"
          title="NON-PAPER source backlog"
          description="通常運転のボトルネック確認用です。"
          accent="cyan"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-2 py-1.5">source</th>
                  <th className="px-2 py-1.5">type</th>
                  <th className="px-2 py-1.5 text-right">unprocessed</th>
                  <th className="px-2 py-1.5 text-right">processed</th>
                  <th className="px-2 py-1.5 text-right">total</th>
                </tr>
              </thead>
              <tbody>
                {data.topNonPaperSources.map((row) => (
                  <SourceRow key={row.sourceKey} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </QueueSection>

        <QueueSection
          eyebrow="Paper Sources"
          title="PAPER source backlog"
          description="研究系 backlog を別面で追います。"
          accent="amber"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-2 py-1.5">source</th>
                  <th className="px-2 py-1.5">type</th>
                  <th className="px-2 py-1.5 text-right">unprocessed</th>
                  <th className="px-2 py-1.5 text-right">processed</th>
                  <th className="px-2 py-1.5 text-right">total</th>
                </tr>
              </thead>
              <tbody>
                {data.topPaperSources.map((row) => (
                  <SourceRow key={row.sourceKey} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </QueueSection>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">推奨フォロープラン</h2>
            <p className="mt-1 text-xs text-slate-400">今の backlog と job 状態から、先に押す価値が高い順に並べています。</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {data.recommendations.map((item) => (
            <RecommendationCard key={item.id} item={item} onRun={runAction} busyAction={busyAction} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <h2 className="text-sm font-bold text-white">COMMON OPS</h2>
        <p className="mt-1 text-xs text-slate-400">lane 共通の補助処理です。</p>
        <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_0.8fr]">
          <div className="grid gap-2">
            {(['run-hourly-fetch', 'run-publish-and-ranks'] as const).map((action) => (
              <button
                key={action}
                onClick={() => runAction(action)}
                disabled={busyAction !== null}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-left text-xs text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === action ? '実行中...' : actionLabel(action)}
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            <SummaryStat
              label="publish 未反映"
              value={data.summary.publishCandidatesPending}
              note="L4 未反映 / 再反映待ち"
            />
            <SummaryStat
              label="manual_pending"
              value={data.summary.manualPending}
              note={`24h 超 total ${data.summary.rawOver24h} / 稼働中ジョブ ${data.summary.currentRunningJobs}`}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  note,
  accent = 'slate',
}: {
  label: string
  value: string | number
  note: string
  accent?: 'slate' | 'cyan' | 'amber'
}) {
  const accentStyle =
    accent === 'cyan'
      ? 'border-cyan-900/70 bg-cyan-950/40'
      : accent === 'amber'
        ? 'border-amber-900/70 bg-amber-950/30'
        : 'border-slate-800 bg-slate-900/70'

  const valueStyle =
    accent === 'cyan' ? 'text-cyan-200' : accent === 'amber' ? 'text-amber-200' : 'text-white'

  return (
    <div className={`rounded-2xl border p-3 ${accentStyle}`}>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-black tracking-[-0.04em] ${valueStyle}`}>{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{note}</p>
    </div>
  )
}

function QueueSection({
  eyebrow,
  title,
  description,
  accent,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  accent: 'cyan' | 'amber' | 'slate'
  children: React.ReactNode
}) {
  const shellStyle =
    accent === 'cyan'
      ? 'border-cyan-900/70 bg-gradient-to-br from-cyan-950/40 via-slate-950/90 to-slate-950/90'
      : accent === 'amber'
        ? 'border-amber-900/70 bg-gradient-to-br from-amber-950/35 via-slate-950/90 to-slate-950/90'
        : 'border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950/90 to-slate-950/90'

  const eyebrowStyle =
    accent === 'cyan' ? 'text-cyan-300' : accent === 'amber' ? 'text-amber-300' : 'text-slate-300'

  return (
    <section className={`rounded-2xl border p-4 ${shellStyle}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${eyebrowStyle}`}>{eyebrow}</p>
      <h2 className="mt-2 text-base font-black tracking-[-0.03em] text-white">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-300">{description}</p>
      <div className="mt-3">{children}</div>
    </section>
  )
}
