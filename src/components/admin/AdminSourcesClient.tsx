'use client'

import { useState, useCallback } from 'react'
import { getAdminApiPath } from '@/lib/admin-path'

type AdminSource = {
  sourceTargetId: string
  sourceKey: string
  displayName: string
  sourceType: string
  isActive: boolean
  contentLanguage: string | null
  baseUrl: string | null
}

function getAdminSecret(): string {
  return localStorage.getItem('admin_secret') ?? ''
}

export function AdminSourcesClient({ initialSources }: { initialSources: AdminSource[] }) {
  const [sources, setSources] = useState(initialSources)
  const [loading, setLoading] = useState<string | null>(null)

  const toggleActive = useCallback(async (source: AdminSource) => {
    const isActive = !source.isActive
    setLoading(source.sourceTargetId)
    try {
      const res = await fetch(getAdminApiPath('/sources'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminSecret()}`,
        },
        body: JSON.stringify({ sourceTargetId: source.sourceTargetId, isActive }),
      })
      if (res.ok) {
        setSources((prev) =>
          prev.map((s) => (s.sourceTargetId === source.sourceTargetId ? { ...s, isActive } : s)),
        )
      } else {
        alert('操作に失敗しました')
      }
    } finally {
      setLoading(null)
    }
  }, [])

  const activeCount = sources.filter((s) => s.isActive).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">ソース管理</h1>
        <p className="text-gray-400 text-sm">{activeCount}/{sources.length} 件アクティブ</p>
      </div>
      <div className="space-y-2">
        {sources.map((source) => (
          <div key={source.sourceTargetId} className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg border border-gray-800">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium">{source.displayName}</p>
              <p className="text-gray-500 text-xs">{source.sourceKey} · {source.sourceType} · {source.contentLanguage ?? 'en'}</p>
              {source.baseUrl && <p className="text-gray-600 text-xs truncate">{source.baseUrl}</p>}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded ${source.isActive ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
              {source.isActive ? 'アクティブ' : '停止中'}
            </span>
            <button
              onClick={() => toggleActive(source)}
              disabled={loading === source.sourceTargetId}
              className={`text-xs px-3 py-1 rounded disabled:opacity-50 ${source.isActive ? 'bg-red-900 hover:bg-red-800 text-red-300' : 'bg-green-900 hover:bg-green-800 text-green-300'}`}
            >
              {loading === source.sourceTargetId ? '処理中' : source.isActive ? '停止する' : '有効にする'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
