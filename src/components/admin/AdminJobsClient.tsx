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

export function AdminJobsClient({ initialRuns }: { initialRuns: JobRun[] }) {
  const [runs, setRuns] = useState(initialRuns)
  const [selectedJob, setSelectedJob] = useState<string>('all')
  const [selectedRun, setSelectedRun] = useState<JobRun | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchRuns = useCallback(async (jobName: string) => {
    setLoading(true)
    try {
      const param = jobName === 'all' ? '' : `&job=${jobName}`
      const res = await fetch(`/api/admin/jobs?limit=50${param}`, {
        headers: { Authorization: `Bearer ${getAdminSecret()}` },
      })
      if (res.ok) {
        const data = (await res.json()) as { runs: JobRun[] }
        setRuns(data.runs)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleJobFilter = (job: string) => {
    setSelectedJob(job)
    void fetchRuns(job)
  }

  const filteredRuns = selectedJob === 'all' ? runs : runs.filter((r) => r.jobName === selectedJob)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">ジョブ実行ログ</h1>
        <button
          onClick={() => fetchRuns(selectedJob)}
          disabled={loading}
          className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded disabled:opacity-50"
        >
          {loading ? '更新中...' : '↺ 更新'}
        </button>
      </div>

      {/* フィルタタブ */}
      <div className="flex flex-wrap gap-2">
        {['all', ...JOB_NAMES].map((job) => (
          <button
            key={job}
            onClick={() => handleJobFilter(job)}
            className={`px-3 py-1 rounded text-xs font-medium ${selectedJob === job ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            {job === 'all' ? 'すべて' : job}
          </button>
        ))}
      </div>

      <p className="text-gray-500 text-xs">{filteredRuns.length} 件</p>

      <div className="space-y-2">
        {filteredRuns.map((run) => (
          <div
            key={run.id}
            onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}
            className="p-3 bg-gray-900 rounded-lg border border-gray-800 cursor-pointer hover:border-gray-700"
          >
            {/* 1行サマリー */}
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${STATUS_STYLE[run.status] ?? 'bg-gray-700 text-gray-400'}`}>
                {run.status}
              </span>
              <span className="text-white text-sm font-medium flex-1 min-w-0 truncate">{run.jobName}</span>
              <span className="text-gray-500 text-xs shrink-0">
                {new Date(run.startedAt).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-gray-500 text-xs shrink-0">{formatDuration(run.durationSeconds)}</span>
            </div>

            {/* 統計バー */}
            <div className="mt-1.5 flex gap-3 text-xs text-gray-500">
              <span>処理 {run.processedCount}</span>
              <span className="text-green-500">成功 {run.successCount}</span>
              {run.failedCount > 0 && <span className="text-red-400">失敗 {run.failedCount}</span>}
            </div>

            {/* エラー表示 */}
            {run.lastError && (
              <p className="mt-1 text-red-400 text-xs truncate">{run.lastError}</p>
            )}

            {/* 展開: 詳細 */}
            {selectedRun?.id === run.id && (
              <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
                <p className="text-gray-400 text-xs">
                  開始: {new Date(run.startedAt).toLocaleString('ja-JP')}
                  {run.finishedAt && ` → 終了: ${new Date(run.finishedAt).toLocaleString('ja-JP')}`}
                </p>
                {run.lastError && (
                  <div className="bg-red-950 rounded p-2">
                    <p className="text-red-400 text-xs font-mono whitespace-pre-wrap break-all">{run.lastError}</p>
                  </div>
                )}
                {Object.keys(run.metadata).length > 0 && (
                  <details className="text-xs">
                    <summary className="text-gray-500 cursor-pointer">metadata を展開</summary>
                    <pre className="mt-1 text-gray-400 bg-gray-800 rounded p-2 overflow-auto text-[11px]">
                      {JSON.stringify(run.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        ))}

        {filteredRuns.length === 0 && (
          <p className="text-gray-500 text-sm py-8 text-center">実行ログがありません</p>
        )}
      </div>
    </div>
  )
}
