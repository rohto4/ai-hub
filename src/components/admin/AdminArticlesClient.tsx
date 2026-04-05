'use client'

import { useState, useCallback } from 'react'
import { getAdminApiPath } from '@/lib/admin-path'

export type AdminArticleRow = {
  id: string
  public_key: string
  title: string
  source_type: string
  source_category: string
  content_language: string | null
  visibility_status: string
  content_score: string | number
  published_at: string
}

export function AdminArticlesClient({ initialArticles }: { initialArticles: AdminArticleRow[] }) {
  const [articles, setArticles] = useState(initialArticles)
  const [filter, setFilter] = useState<'all' | 'published' | 'hidden'>('all')
  const [loading, setLoading] = useState<string | null>(null)

  const toggleVisibility = useCallback(async (article: AdminArticleRow) => {
    const action = article.visibility_status === 'published' ? 'hide' : 'unhide'
    setLoading(article.id)
    try {
      const res = await fetch(getAdminApiPath(`/articles/${article.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_secret') ?? ''}`,
        },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setArticles((prev) =>
          prev.map((a) =>
            a.id === article.id
              ? { ...a, visibility_status: action === 'hide' ? 'hidden' : 'published' }
              : a,
          ),
        )
      } else {
        alert('操作に失敗しました')
      }
    } finally {
      setLoading(null)
    }
  }, [])

  const filtered = articles.filter((a) => filter === 'all' || a.visibility_status === filter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">記事管理</h1>
        <div className="flex gap-2">
          {(['all', 'published', 'hidden'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              {f === 'all' ? '全て' : f === 'published' ? '公開中' : '非表示'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-gray-400 text-sm">{filtered.length} 件表示（最新200件）</p>
      <div className="space-y-2">
        {filtered.map((article) => (
          <div key={article.id} className="flex items-start gap-3 p-3 bg-gray-900 rounded-lg border border-gray-800">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{article.title}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {article.source_type} · {article.content_language ?? 'en'} · score:{Number(article.content_score).toFixed(1)} · {new Date(article.published_at).toLocaleDateString('ja-JP')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded ${article.visibility_status === 'published' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                {article.visibility_status === 'published' ? '公開' : '非表示'}
              </span>
              <button
                onClick={() => toggleVisibility(article)}
                disabled={loading === article.id}
                className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded disabled:opacity-50"
              >
                {loading === article.id ? '処理中' : article.visibility_status === 'published' ? '非表示にする' : '公開に戻す'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
