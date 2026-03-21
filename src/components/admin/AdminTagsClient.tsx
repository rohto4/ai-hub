'use client'

import { useState, useCallback } from 'react'

type TagCandidate = {
  tagKey: string
  displayName: string
  seenCount: number
  reviewStatus: string
  firstSeenAt: string
  lastSeenAt: string
}

function getAdminSecret(): string {
  return localStorage.getItem('admin_secret') ?? ''
}

export function AdminTagsClient({ initialCandidates }: { initialCandidates: TagCandidate[] }) {
  const [candidates, setCandidates] = useState(initialCandidates)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<Record<string, string>>({})

  const handlePromote = useCallback(async (candidate: TagCandidate) => {
    const displayName = editingName[candidate.tagKey] ?? candidate.displayName
    setPromoting(candidate.tagKey)
    try {
      const res = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminSecret()}`,
        },
        body: JSON.stringify({ action: 'promote', tagKey: candidate.tagKey, displayName }),
      })
      if (res.ok) {
        setCandidates((prev) => prev.filter((c) => c.tagKey !== candidate.tagKey))
      } else {
        alert('昇格に失敗しました')
      }
    } finally {
      setPromoting(null)
    }
  }, [editingName])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">タグレビュー</h1>
      <p className="text-gray-400 text-sm">候補タグ: {candidates.length} 件（未昇格のみ表示）</p>
      <div className="space-y-2">
        {candidates.map((candidate) => (
          <div key={candidate.tagKey} className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg border border-gray-800">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-mono">{candidate.tagKey}</p>
              <p className="text-gray-500 text-xs">見出し数: {candidate.seenCount} · 最終: {new Date(candidate.lastSeenAt).toLocaleDateString('ja-JP')}</p>
            </div>
            <input
              type="text"
              value={editingName[candidate.tagKey] ?? candidate.displayName}
              onChange={(e) => setEditingName((prev) => ({ ...prev, [candidate.tagKey]: e.target.value }))}
              className="w-40 px-2 py-1 bg-gray-800 text-white rounded border border-gray-700 text-sm focus:outline-none"
              placeholder="表示名"
            />
            <button
              onClick={() => handlePromote(candidate)}
              disabled={promoting === candidate.tagKey}
              className="text-xs px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {promoting === candidate.tagKey ? '昇格中...' : 'マスタに昇格'}
            </button>
          </div>
        ))}
        {candidates.length === 0 && (
          <p className="text-gray-500 text-sm py-4 text-center">候補タグはありません</p>
        )}
      </div>
    </div>
  )
}
