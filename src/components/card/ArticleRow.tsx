import Link from 'next/link'
import type { ArticleWithScore } from '@/lib/db/types'

interface Props {
  article: ArticleWithScore
  summaryMode: 100 | 200
}

export function ArticleRow({ article, summaryMode }: Props) {
  const emoji = article.thumbnail_emoji ?? '📝'
  const summary = summaryMode === 200 ? (article.summary_200 ?? article.summary_100) : null
  const href = `/articles/${article.publicKey ?? article.id}`

  return (
    <div className="flex items-start gap-2.5 border-b border-black/5 py-2 last:border-b-0">
      {/* 絵文字サムネイル */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[22px]"
        style={{ background: 'linear-gradient(145deg, #ffe8d6, #ffd8bd)' }}>
        {emoji}
      </div>

      {/* テキスト */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={href}
          className="line-clamp-1 text-[12px] font-extrabold text-ink hover:underline"
        >
          {article.title}
        </Link>
        {summaryMode === 200 && summary ? (
          <p className="line-clamp-2 text-[11px] text-[#4f5969]">{summary}</p>
        ) : (
          <p className="line-clamp-1 text-[11px] text-muted">
            {article.summary_100 ?? '要約は準備中です。'}
          </p>
        )}
      </div>

      {/* 元記事リンク */}
      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 self-center rounded-full px-2.5 py-1 text-[10px] font-bold"
        style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent-darker)' }}
      >
        元記事
      </a>
    </div>
  )
}
