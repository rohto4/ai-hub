import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicArticleList } from '@/components/site/PublicArticleList'
import { EmptyPanel, PublicScaffold } from '@/components/site/PublicScaffold'
import { isDatabaseConfigured } from '@/lib/db'
import { getPublicArticleDetail, listLatestPublicArticles } from '@/lib/db/public-feed'

const APP_URL = process.env.APP_URL ?? process.env.VERCEL_URL ?? 'http://localhost:3000'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicKey: string }>
}): Promise<Metadata> {
  const { publicKey } = await params
  if (!isDatabaseConfigured()) return {}

  const article = await getPublicArticleDetail(publicKey)
  if (!article) return {}

  const ogImageUrl = `${APP_URL}/api/og?publicKey=${publicKey}`
  return {
    title: article.title,
    description: article.summary_100 ?? article.title,
    openGraph: {
      title: article.title,
      description: article.summary_100 ?? article.title,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.summary_100 ?? article.title,
      images: [ogImageUrl],
    },
  }
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ publicKey: string }>
}) {
  const { publicKey } = await params

  if (!isDatabaseConfigured()) {
    return (
      <PublicScaffold title="記事詳細" description="L4 公開記事の詳細ビューです。">
        <EmptyPanel message="データベース未接続のため記事を表示できません。" />
      </PublicScaffold>
    )
  }

  const article = await getPublicArticleDetail(publicKey)
  if (!article) {
    notFound()
  }

  const related = await listLatestPublicArticles({
    limit: 6,
    sourceCategory: article.sourceCategory,
    sourceType: article.source_type,
  })

  return (
    <PublicScaffold title={article.title} description="public_articles を読む記事詳細ページの最小構成です。">
      <section className="grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
        <article className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-28 w-24 items-center justify-center rounded-3xl bg-accent-lighter text-5xl">
              {article.thumbnail_emoji ?? '📝'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-[#dbeafe] px-2 py-1 font-bold text-[#1d4ed8]">{article.source_type}</span>
                <span className="rounded-full bg-[#f6f0ea] px-2 py-1 font-bold text-accent-darker">{article.sourceCategory}</span>
                <span className="text-muted">{article.published_at.toLocaleString('ja-JP')}</span>
              </div>
              <h2 className="text-2xl font-extrabold leading-tight">{article.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#4f5969]">{article.summary_200 ?? article.summary_100 ?? '要約は準備中です。'}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <Link key={tag.tagKey} href={`/tags/${tag.tagKey}`} className="rounded-full bg-accent-light px-3 py-1 text-xs font-bold text-accent-dark">
                #{tag.displayName}
              </Link>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a href={article.url} target="_blank" rel="noreferrer" className="rounded-2xl bg-btn-dark px-4 py-3 text-sm font-bold text-white">
              元記事を開く
            </a>
            <Link href={`/category/${article.source_type}`} className="rounded-2xl bg-accent-light px-4 py-3 text-sm font-bold text-accent-dark">
              同じ source_type を見る
            </Link>
          </div>
        </article>

        <aside className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <h3 className="text-lg font-extrabold">関連ソース</h3>
          <div className="mt-4 grid gap-3">
            {article.sources.map((source) => (
              <div key={source.sourceKey} className="rounded-2xl bg-[#f8f2ec] p-3">
                <div className="text-xs text-muted">{source.sourceType}</div>
                <div className="font-bold">{source.displayName}</div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="mt-8">
        <h3 className="mb-4 text-xl font-extrabold">近いレーンの公開記事</h3>
        <PublicArticleList articles={related.filter((item) => item.id !== article.id).slice(0, 4)} />
      </section>
    </PublicScaffold>
  )
}
