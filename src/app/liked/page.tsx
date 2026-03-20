'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PublicScaffold, EmptyPanel } from '@/components/site/PublicScaffold'
import { getLikedArticleIds } from '@/lib/client/home'
import type { ArticleWithScore } from '@/lib/db/types'

export default function LikedPage() {
  const [articles, setArticles] = useState<ArticleWithScore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ids = getLikedArticleIds()
    if (ids.length === 0) { setLoading(false); return }

    void Promise.all(
      ids.map((id) =>
        fetch(`/api/articles/${id}`)
          .then((r) => (r.ok ? (r.json() as Promise<ArticleWithScore>) : null))
          .catch(() => null),
      ),
    ).then((results) => {
      setArticles(results.filter((a): a is ArticleWithScore => a !== null))
      setLoading(false)
    })
  }, [])

  return (
    <PublicScaffold title="高評価" description="★ をつけた記事の一覧です。">
      {loading ? (
        <div className="rounded-3xl bg-white p-8 text-center text-muted shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          読み込み中...
        </div>
      ) : articles.length === 0 ? (
        <EmptyPanel message="高評価にした記事はありません。記事カードの ☆ ボタンから追加できます。" />
      ) : (
        <div className="grid gap-4">
          {articles.map((article) => (
            <article key={article.id} className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
              <div className="flex gap-4">
                <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-2xl text-[30px]"
                  style={{ background: 'linear-gradient(145deg, #ffe8d6, #ffd8bd)' }}>
                  {article.thumbnail_emoji ?? '📝'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="rounded-full bg-[#dbeafe] px-2 py-0.5 font-bold text-[#1d4ed8]">{article.source_type}</span>
                    <span className="rounded-full bg-[#f6f0ea] px-2 py-0.5 font-bold text-accent-darker">{article.genre}</span>
                    <span className="text-muted">{article.published_at.toLocaleDateString('ja-JP')}</span>
                  </div>
                  <Link href={`/articles/${article.publicKey ?? article.id}`} className="text-[15px] font-extrabold leading-tight hover:underline">
                    {article.title}
                  </Link>
                  <p className="mt-1.5 text-[12px] leading-[1.7] text-[#4f5969]">
                    {article.summary_100 ?? '要約は準備中です。'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link href={`/articles/${article.publicKey ?? article.id}`}
                  className="rounded-xl px-4 py-2 text-[12px] font-bold text-accent-darker"
                  style={{ background: 'var(--color-accent-light)' }}>
                  詳細を読む
                </Link>
                <a href={article.url} target="_blank" rel="noreferrer"
                  className="rounded-xl px-4 py-2 text-[12px] font-bold text-white"
                  style={{ background: 'var(--color-orange)' }}>
                  元記事を開く ↗
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </PublicScaffold>
  )
}
