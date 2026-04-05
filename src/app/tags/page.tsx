import Link from 'next/link'
import { PublicDiscoveryRail } from '@/components/site/PublicDiscoveryRail'
import { EmptyPanel, PublicScaffold } from '@/components/site/PublicScaffold'
import { isDatabaseConfigured } from '@/lib/db'
import { listAdjacentTagSummaries } from '@/lib/db/adjacent-tags'
import { listTagSummaries } from '@/lib/db/public-feed'

function TagSection({
  title,
  description,
  tags,
  tone = 'primary',
}: {
  title: string
  description: string
  tags: Awaited<ReturnType<typeof listTagSummaries>>
  tone?: 'primary' | 'adjacent'
}) {
  const cardClassName =
    tone === 'adjacent'
      ? 'border-white/70 bg-white/72'
      : 'border-[color:var(--color-accent-dark)]/10 bg-[color:var(--color-panel-strong)]'

  return (
    <section className="site-panel">
      <div className="site-eyebrow">{tone === 'adjacent' ? 'Adjacent' : 'Primary'}</div>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[color:var(--color-ink)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--color-subtle)]">{description}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {tags.map((tag) => (
          <Link
            key={`${tone}-${tag.tagKey}`}
            href={`/tags/${tag.tagKey}`}
            className={`group rounded-[24px] border p-5 shadow-[0_16px_45px_rgba(43,31,24,0.05)] transition duration-300 hover:-translate-y-0.5 hover:bg-white ${cardClassName}`}
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
              #{tag.tagKey}
            </div>
            <div className="mt-2 text-xl font-black tracking-[-0.04em] text-[color:var(--color-ink)]">
              {tag.displayName}
            </div>
            <div className="mt-4 inline-flex rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-[color:var(--color-accent-darker)]">
              {tag.articleCount} 件
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default async function TagsPage() {
  const [primaryTags, adjacentTags] = isDatabaseConfigured()
    ? await Promise.all([listTagSummaries(40), listAdjacentTagSummaries(24)])
    : [[], []]

  return (
    <PublicScaffold
      eyebrow="Tag Directory"
      title="タグ一覧"
      description="主タグを主導線に、周辺分野タグを補助導線に置いて比較できるようにした一覧です。どこまで同列に見せるかを実画面で確認できます。"
      sidebar={<PublicDiscoveryRail primaryTags={primaryTags} adjacentTags={adjacentTags} />}
    >
      {primaryTags.length > 0 ? (
        <div className="space-y-6">
          <TagSection
            title="主タグ"
            description="固有名詞・製品名・企業名・モデル名を中心に、深掘り導線として使うタグです。"
            tags={primaryTags}
          />
          <TagSection
            title="周辺分野タグ"
            description="主タグとは別段で見せつつ、当面は同じクリック導線でユーザーが意識的に絞り込みを調整できるようにしています。"
            tags={adjacentTags}
            tone="adjacent"
          />
        </div>
      ) : (
        <EmptyPanel message="タグ集計を取得できませんでした。" />
      )}
    </PublicScaffold>
  )
}
