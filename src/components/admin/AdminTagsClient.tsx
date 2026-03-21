'use client'

import { useState, useCallback } from 'react'

type TagCandidate = {
  tagKey: string
  displayName: string
  seenCount: number
  reviewStatus: string
  firstSeenAt: string
  lastSeenAt: string
  originTitle: string | null
  originSnippet: string | null
}

type ViewTab = 'candidate' | 'manual_review'

function getAdminSecret(): string {
  return typeof window !== 'undefined' ? (localStorage.getItem('admin_secret') ?? '') : ''
}

async function callTagApi(body: Record<string, unknown>) {
  return fetch('/api/admin/tags', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminSecret()}`,
    },
    body: JSON.stringify(body),
  })
}

async function fetchCandidates(status: ViewTab): Promise<TagCandidate[]> {
  const res = await fetch(`/api/admin/tags?status=${status}`, {
    headers: { Authorization: `Bearer ${getAdminSecret()}` },
  })
  if (!res.ok) return []
  const data = (await res.json()) as { candidates: TagCandidate[] }
  return data.candidates
}

export function AdminTagsClient({ initialCandidates }: { initialCandidates: TagCandidate[] }) {
  const [tab, setTab] = useState<ViewTab>('candidate')
  const [candidates, setCandidates] = useState(initialCandidates)
  const [processing, setProcessing] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<Record<string, string>>({})
  const [expandedContext, setExpandedContext] = useState<string | null>(null)

  const switchTab = useCallback(async (newTab: ViewTab) => {
    setTab(newTab)
    const items = await fetchCandidates(newTab)
    setCandidates(items)
  }, [])

  const removeFromList = (tagKey: string) =>
    setCandidates((prev) => prev.filter((c) => c.tagKey !== tagKey))

  const handlePromote = useCallback(async (candidate: TagCandidate) => {
    const displayName = editingName[candidate.tagKey] ?? candidate.displayName
    setProcessing(candidate.tagKey)
    try {
      const res = await callTagApi({ action: 'promote', tagKey: candidate.tagKey, displayName })
      if (res.ok) removeFromList(candidate.tagKey)
      else alert('昇格に失敗しました')
    } finally { setProcessing(null) }
  }, [editingName])

  const handleHold = useCallback(async (tagKey: string) => {
    setProcessing(tagKey)
    try {
      const res = await callTagApi({ action: 'hold', tagKey })
      if (res.ok) removeFromList(tagKey)
      else alert('操作に失敗しました')
    } finally { setProcessing(null) }
  }, [])

  const handleReject = useCallback(async (tagKey: string) => {
    if (!confirm(`「${tagKey}」を棄却しますか？`)) return
    setProcessing(tagKey)
    try {
      const res = await callTagApi({ action: 'reject', tagKey })
      if (res.ok) removeFromList(tagKey)
      else alert('棄却に失敗しました')
    } finally { setProcessing(null) }
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">タグレビュー</h1>

      {/* タブ */}
      <div className="flex gap-2">
        {([['candidate', '未レビュー'], ['manual_review', '保留中']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`px-4 py-1.5 rounded text-sm font-medium ${tab === key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-gray-400 text-sm">{candidates.length} 件</p>

      <div className="space-y-3">
        {candidates.map((candidate) => (
          <div key={candidate.tagKey} className="p-4 bg-gray-900 rounded-lg border border-gray-800 space-y-3">
            {/* ヘッダー行 */}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-mono font-bold">{candidate.tagKey}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  出現 {candidate.seenCount} 回 · 初出 {new Date(candidate.firstSeenAt).toLocaleDateString('ja-JP')} · 最終 {new Date(candidate.lastSeenAt).toLocaleDateString('ja-JP')}
                </p>
              </div>
              {/* 表示名入力 */}
              <input
                type="text"
                value={editingName[candidate.tagKey] ?? candidate.displayName}
                onChange={(e) => setEditingName((prev) => ({ ...prev, [candidate.tagKey]: e.target.value }))}
                className="w-36 px-2 py-1 bg-gray-800 text-white rounded border border-gray-700 text-sm focus:outline-none focus:border-blue-500"
                placeholder="表示名"
              />
            </div>

            {/* 出現文脈 */}
            {candidate.originTitle && (
              <div className="bg-gray-800 rounded p-2.5">
                <p className="text-gray-300 text-xs font-medium mb-1">📰 {candidate.originTitle}</p>
                {candidate.originSnippet && (
                  <div>
                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">
                      {candidate.originSnippet}
                    </p>
                    {candidate.originSnippet.length > 120 && (
                      <button
                        onClick={() => setExpandedContext(expandedContext === candidate.tagKey ? null : candidate.tagKey)}
                        className="text-blue-400 text-xs mt-1"
                      >
                        {expandedContext === candidate.tagKey ? '折りたたむ' : '続きを見る'}
                      </button>
                    )}
                    {expandedContext === candidate.tagKey && (
                      <p className="text-gray-500 text-xs leading-relaxed mt-1">{candidate.originSnippet}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex gap-2">
              <button
                onClick={() => handlePromote(candidate)}
                disabled={processing === candidate.tagKey}
                className="flex-1 text-xs py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {processing === candidate.tagKey ? '処理中...' : '✓ マスタに昇格'}
              </button>
              {tab === 'candidate' && (
                <button
                  onClick={() => handleHold(candidate.tagKey)}
                  disabled={processing === candidate.tagKey}
                  className="text-xs px-3 py-1.5 bg-yellow-900 hover:bg-yellow-800 text-yellow-300 rounded disabled:opacity-50"
                >
                  ⏸ 保留
                </button>
              )}
              {tab === 'manual_review' && (
                <button
                  onClick={async () => {
                    setProcessing(candidate.tagKey)
                    try {
                      const res = await callTagApi({ action: 'restore', tagKey: candidate.tagKey })
                      if (res.ok) removeFromList(candidate.tagKey)
                    } finally { setProcessing(null) }
                  }}
                  disabled={processing === candidate.tagKey}
                  className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded disabled:opacity-50"
                >
                  ↩ 候補に戻す
                </button>
              )}
              <button
                onClick={() => handleReject(candidate.tagKey)}
                disabled={processing === candidate.tagKey}
                className="text-xs px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 rounded disabled:opacity-50"
              >
                ✗ 棄却
              </button>
            </div>
          </div>
        ))}

        {candidates.length === 0 && (
          <p className="text-gray-500 text-sm py-8 text-center">
            {tab === 'candidate' ? '未レビューのタグ候補はありません' : '保留中のタグはありません'}
          </p>
        )}
      </div>
    </div>
  )
}
