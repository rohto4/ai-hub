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
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{job.jobName}</p>
          <p className="mt-1 text-xs text-slate-400">{job.scheduleLabel}</p>
          {enrichScheduleLabel ? (
            <p className="mt-1 text-xs text-cyan-300">
              {enrichScheduleLabel}
              {job.scheduleRunsRunning ? ` / 実行中 ${job.scheduleRunsRunning}` : ''}
              {job.scheduleRunsFailed ? ` / 失敗 ${job.scheduleRunsFailed}` : ''}
            </p>
          ) : null}
        </div>
        <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${statusStyle}`}>
          {job.status}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300 md:grid-cols-4">
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
    <tr className="border-t border-slate-800 text-sm text-slate-200">
      <td className="px-3 py-2 font-mono text-xs text-sky-300">{row.sourceKey}</td>
      <td className="px-3 py-2 text-right">{row.rawUnprocessed}</td>
      <td className="px-3 py-2 text-right text-slate-400">{row.rawProcessed}</td>
      <td className="px-3 py-2 text-right text-slate-500">{row.rawTotal}</td>
    </tr>
  )
}

function actionLabel(key: AdminEnrichActionKey): string {
  switch (key) {
    case 'run-hourly-layer12-recovery':
      return '推奨回復を実行'
    case 'run-hourly-layer12-8cycles':
      return '8サイクル回復を実行'
    case 'run-enrich-worker':
      return '標準 enrich を 1 回実行'
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
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-sm font-semibold text-white">{item.title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{item.reason}</p>
      {item.actionKey && item.actionLabel ? (
        <button
          onClick={() => onRun(item.actionKey!)}
          disabled={busyAction !== null}
          className="mt-4 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyAction === item.actionKey ? '実行中...' : item.actionLabel}
        </button>
      ) : (
        <p className="mt-4 text-xs text-amber-300">この項目は現状ボタン実行なしです</p>
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

  const cards = [
    { label: '未処理 backlog', value: data.summary.rawUnprocessed, note: `今すぐ裁ける ${data.summary.rawDueNow} / ロック中 ${data.summary.rawLocked}` },
    { label: '24h 超 backlog', value: data.summary.rawOver24h, note: '古い未処理' },
    { label: 'manual_pending', value: data.summary.manualPending, note: '別ライン回収' },
    { label: 'publish 未反映', value: data.summary.publishCandidatesPending, note: 'L4 未反映 / 再反映待ち' },
    { label: '稼働中ジョブ', value: data.summary.currentRunningJobs, note: 'job_runs.status=running' },
    { label: '理論解消時間', value: `${data.summary.estimatedDrainHoursAtScheduledRate}h`, note: '160件/時の単純計算' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-[-0.03em] text-white">Enrich Queue Ops</h1>
          <p className="mt-2 text-sm text-slate-400">
            DB で裁くべき backlog、現在のジョブ状態、推奨フォロープラン、即時実行を 1 画面で確認します。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">checked: {formatDateTime(data.checkedAt)}</p>
          <button
            onClick={refresh}
            disabled={isPending || busyAction !== null}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">{card.value}</p>
            <p className="mt-2 text-xs text-slate-500">{card.note}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">推奨フォロープラン</h2>
              <p className="mt-1 text-sm text-slate-400">今の backlog と job 状態から、先に押す価値が高い順に並べています。</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            {data.recommendations.map((item) => (
              <RecommendationCard key={item.id} item={item} onRun={runAction} busyAction={busyAction} />
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
          <h2 className="text-lg font-bold text-white">即時実行</h2>
          <p className="mt-1 text-sm text-slate-400">小さく切ったジョブだけ置いています。長時間バッチの完全自動化はここではやりません。</p>
          <div className="mt-4 grid gap-3">
            {([
              'run-hourly-layer12-recovery',
              'run-hourly-layer12-8cycles',
              'run-enrich-worker',
              'run-enrich-arxiv',
              'run-hourly-fetch',
              'run-publish-and-ranks',
            ] as const).map((action) => (
              <button
                key={action}
                onClick={() => runAction(action)}
                disabled={busyAction !== null}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm text-slate-100 transition hover:border-cyan-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === action ? '実行中...' : actionLabel(action)}
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-xs text-slate-400">
            <p>最大 backlog source: <span className="font-mono text-sky-300">{data.summary.topSourceKey ?? 'n/a'}</span></p>
            <p className="mt-1">pending: {data.summary.topSourcePending}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
        <h2 className="text-lg font-bold text-white">現在のジョブ稼働状況</h2>
        <p className="mt-1 text-sm text-slate-400">schedule と最新実行を同じ面で見ます。</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {data.jobs.map((job) => (
            <JobRow key={job.jobName} job={job} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">source 別 backlog</h2>
            <p className="mt-1 text-sm text-slate-400">未処理が多い source から並べています。</p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="px-3 py-2">source</th>
                <th className="px-3 py-2 text-right">unprocessed</th>
                <th className="px-3 py-2 text-right">processed</th>
                <th className="px-3 py-2 text-right">total</th>
              </tr>
            </thead>
            <tbody>
              {data.topSources.map((row) => (
                <SourceRow key={row.sourceKey} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
