import { PublicArticleList } from '@/components/site/PublicArticleList'
import { PublicDiscoveryRail } from '@/components/site/PublicDiscoveryRail'
import { EmptyPanel, PublicScaffold } from '@/components/site/PublicScaffold'
import { isDatabaseConfigured } from '@/lib/db'
import { listAdjacentTagSummaries } from '@/lib/db/adjacent-tags'
import { listArticlesByTag, listLatestPublicArticles, listRankedPublicArticles, listTagSummaries } from '@/lib/db/public-feed'
import { findSiteCategory } from '@/lib/site/navigation'

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const category = findSiteCategory(slug)

  const [primaryTags, adjacentTags, articles] = isDatabaseConfigured()
    ? await Promise.all([
        listTagSummaries(18),
        listAdjacentTagSummaries(18),
        category?.kind === 'source-type'
          ? listLatestPublicArticles({ limit: 30, sourceType: category.queryValue })
          : category?.kind === 'source-category'
            ? listRankedPublicArticles({ period: '24h', sourceCategory: category.queryValue, limit: 30 })
            : category?.kind === 'tag'
              ? listArticlesByTag({ tagKey: category.queryValue, limit: 30 })
            : Promise.resolve([]),
      ])
    : [[], [], []]

  const title = category?.label ?? slug
  const description = category
    ? `カテゴリ「${category.label}」の一覧です。カテゴリ導線の位置づけを確認しやすいよう、ここでは一覧を素直に見せています。`
    : `カテゴリ「${slug}」の一覧です。`

  return (
    <PublicScaffold
      eyebrow="Category"
      title={title}
      description={description}
      sidebar={<PublicDiscoveryRail primaryTags={primaryTags} adjacentTags={adjacentTags} />}
    >
      {articles.length > 0 ? (
        <PublicArticleList articles={articles} showRank={category?.kind === 'source-category'} />
      ) : (
        <EmptyPanel message={`カテゴリ「${slug}」に一致する記事はまだありません。`} />
      )}
    </PublicScaffold>
  )
}
