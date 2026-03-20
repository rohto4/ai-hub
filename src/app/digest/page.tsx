import Link from 'next/link'
import { EmptyPanel, PublicScaffold } from '@/components/site/PublicScaffold'
import { isDatabaseConfigured } from '@/lib/db'
import { listDigestArticles } from '@/lib/db/public-feed'

export default async function DigestPage() {
  const articles = isDatabaseConfigured() ? await listDigestArticles(10) : []
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <PublicScaffold
      title={`AIダイジェスト — ${today}`}
      description="今日のトップ記事をまとめて確認できます。通知からも同じページに繋がります。"
    >
      {articles.length === 0 ? (
        <EmptyPanel message="ダイジェスト記事を取得できませんでした。" />
      ) : (
        <div className="grid gap-5">
          {articles.map((article, index) => {
            const emoji = article.thumbnail_emoji ?? '📝'
            const href = `/articles/${article.publicKey ?? article.id}`
            return (
              <article
                key={article.id}
                className="overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
              >
                <div className="flex items-start gap-4 p-5">
                  {/* ランク + 絵文字 */}
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
                      style={{ background: index < 3 ? 'var(--color-orange)' : 'var(--color-btn-dark)' }}
                    >
                      {index + 1}
                    </span>
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-2xl text-[28px]"
                      style={{ background: 'linear-gradient(145deg, #ffe8d6, #ffd8bd)' }}
                    >
                      {emoji}
                    </div>
                  </div>

                  {/* テキスト */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap gap-1.5 text-[10px]">
                      <span className="rounded-full bg-[#dbeafe] px-2 py-0.5 font-bold text-[#1d4ed8]">
                        {article.source_type}
                      </span>
                      <span className="rounded-full bg-[#f6f0ea] px-2 py-0.5 font-bold text-accent-darker">
                        {article.genre}
                      </span>
                      <span className="text-muted">
                        {article.published_at.toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    <Link href={href} className="text-[16px] font-extrabold leading-tight hover:underline">
                      {article.title}
                    </Link>
                    <p className="mt-2 text-[13px] leading-[1.7] text-[#4f5969]">
                      {article.summary_200 ?? article.summary_100 ?? '要約は準備中です。'}
                    </p>
                  </div>
                </div>

                {/* フッター：記事へのリンク（目立つ配置） */}
                <div className="flex items-center justify-between border-t border-black/5 px-5 py-3">
                  <Link
                    href={href}
                    className="text-[12px] font-bold text-accent-darker hover:underline"
                  >
                    詳細を読む →
                  </Link>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl px-4 py-2 text-[12px] font-bold text-white"
                    style={{ background: 'var(--color-orange)' }}
                  >
                    元記事を開く ↗
                  </a>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </PublicScaffold>
  )
}
