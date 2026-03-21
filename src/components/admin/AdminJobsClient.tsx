'use client'

import { useState, useCallback } from 'react'

type JobRun = {
  id: number
  jobName: string
  status: 'running' | 'completed' | 'failed'
  startedAt: string
  finishedAt: string | null
  processedCount: number
  successCount: number
  failedCount: number
  durationSeconds: number
  metadata: Record<string, unknown>
  lastError: string | null
}

type FailedItem = {
  itemKey: string
  status: string
  errorMessage: string | null
  detail: Record<string, unknown>
  createdAt: string
}

const JOB_NAMES = ['hourly-fetch', 'daily-enrich', 'hourly-publish', 'compute-ranks', 'monthly-public-archive']

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-green-900 text-green-300',
  failed: 'bg-red-900 text-red-300',
  running: 'bg-yellow-900 text-yellow-300',
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m${s}s`
}

function getAdminSecret(): string {
  return typeof window !== 'undefined' ? (localStorage.getItem('admin_secret') ?? '') : ''
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${getAdminSecret()}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function AdminJobsClient({ initialRuns }: { initialRuns: JobRun[] }) {
  const [runs, setRuns] = useState(initialRuns)
  const [selectedJob, setSelectedJob] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [failedItems, setFailedItems] = useState<Record<number, FailedItem[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRuns = useCallback(async (jobName: string) => {
    setLoading(true)
    setError(null)
    try {
      const param = jobName === 'all' ? '' : `&job=${encodeURIComponent(jobName)}`
      const data = await apiFetch<{ runs: JobRun[] }>(`/api/admin/jobs?limit=50${param}`)
      setRuns(data.runs)
    } catch (err) {
      setError(err instanceof Error ? err.message : '取得失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchFailedItems = useCallback(async (runId: number) => {
    if (failedItems[runId]) return // キャッシュ済み
    try {
      const data = await apiFetch<{ failedItems: FailedItem[] }>(`/api/admin/jobs/${runId}`)
      setFailedItems((prev) => ({ ...prev, [runId]: data.failedItems }))
    } catch (err) {
      console.error('failed items fetch error:', err)
    }
  }, [failedItems])

  const handleJobFilter = (job: string) => {
    setSelectedJob(job)
    void fetchRuns(job)
  }

  const toggleExpand = (run: JobRun) => {
    if (expandedId === run.id) {
      setExpandedId(null)
    } else {
      setExpandedId(run.id)
      if (run.failedCount > 0) {
        void fetchFailedItems(run.id)
      }
    }
  }

  const filteredRuns = selectedJob === 'all' ? runs : runs.filter((r) => r.jobName === selectedJob)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">ジョブ実行ログ</h1>
        <button
          onClick={() => void fetchRuns(selectedJob)}
          disabled={loading}
          className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded disabled:opacity-50"
        >
          {loading ? '更新中...' : '↺ 更新'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-950 border border-red-800 rounded text-red-400 text-sm">
          エラー: {error}
          <span className="ml-2 text-red-600 text-xs">（admin_secretがlocalStorageに保存されていない場合は再ログインしてください）</span>
        </div>
      )}

      {/* フィルタタブ */}
      <div className="flex flex-wrap gap-2">
        {(['all', ...JOB_NAMES] as const).map((job) => (
          <button
            key={job}
            onClick={() => handleJobFilter(job)}
            className={`px-3 py-1 rounded text-xs font-medium ${selectedJob === job ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            {job === 'all' ? 'すべて' : job}
          </button>
        ))}
      </div>

      <p className="text-gray-500 text-xs">{filteredRuns.length} 件（クリックで詳細展開）</p>

      <div className="space-y-2">
        {filteredRuns.map((run) => (
          <div
            key={run.id}
            className="bg-gray-900 rounded-lg border border-gray-800"
          >
            {/* 1行サマリー（クリックで展開） */}
            <div
              onClick={() => toggleExpand(run)}
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-800/50 rounded-lg"
            >
              <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${STATUS_STYLE[run.status] ?? 'bg-gray-700 text-gray-400'}`}>
                {run.status}
              </span>
              <span className="text-white text-sm font-medium flex-1 min-w-0 truncate">{run.jobName}</span>
              <span className="text-gray-500 text-xs shrink-0">
                {new Date(run.startedAt).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-gray-500 text-xs shrink-0">{formatDuration(run.durationSeconds)}</span>
              <span className="text-gray-600 text-xs shrink-0">{expandedId === run.id ? '▲' : '▼'}</span>
            </div>

            {/* 統計 + エラー（常時表示） */}
            <div className="px-3 pb-2 flex gap-3 text-xs text-gray-500">
              <span>処理 {run.processedCount}</span>
              <span className="text-green-500">成功 {run.successCount}</span>
              {run.failedCount > 0 && <span className="text-red-400 font-medium">失敗 {run.failedCount}</span>}
            </div>

            {run.lastError && (
              <div className="mx-3 mb-2 px-2 py-1 bg-red-950 rounded text-red-400 text-xs truncate">
                {run.lastError}
              </div>
            )}

            {/* 展開詳細 */}
            {expandedId === run.id && (
              <div className="px-3 pb-3 pt-1 border-t border-gray-800 space-y-3">
                {/* 日時 */}
                <p className="text-gray-500 text-xs">
                  開始: {new Date(run.startedAt).toLocaleString('ja-JP')}
                  {run.finishedAt && ` → 終了: ${new Date(run.finishedAt).toLocaleString('ja-JP')}`}
                </p>

                {/* metadata */}
                {Object.keys(run.metadata).length > 0 && (
                  <details className="text-xs">
                    <summary className="text-gray-500 cursor-pointer hover:text-gray-400">metadata</summary>
                    <pre className="mt-1 text-gray-400 bg-gray-800 rounded p-2 overflow-auto text-[11px] max-h-40">
                      {JSON.stringify(run.metadata, null, 2)}
                    </pre>
                  </details>
                )}

                {/* 失敗 items */}
                {run.failedCount > 0 && (
                  <div className="space-y-1">
                    <p className="text-red-400 text-xs font-medium">失敗 items（最大100件）:</p>
                    {failedItems[run.id] ? (
                      failedItems[run.id].length === 0 ? (
                        <p className="text-gray-600 text-xs">item ログなし</p>
                      ) : (
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {failedItems[run.id].map((item, i) => (
                            <div key={i} className="bg-red-950/50 rounded p-2 text-xs">
                              <span className="text-gray-400 font-mono">{item.itemKey}</span>
                              {item.errorMessage && (
                                <p className="text-red-400 mt-0.5 break-all">{item.errorMessage}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      <p className="text-gray-600 text-xs">読み込み中...</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {filteredRuns.length === 0 && !loading && (
          <p className="text-gray-500 text-sm py-8 text-center">実行ログがありません</p>
        )}
      </div>
    </div>
  )
}
