import { PublicArticleList } from '@/components/site/PublicArticleList'
import { PublicDiscoveryRail } from '@/components/site/PublicDiscoveryRail'
import { EmptyPanel, PublicScaffold } from '@/components/site/PublicScaffold'
import { isDatabaseConfigured } from '@/lib/db'
import { listAdjacentTagSummaries } from '@/lib/db/adjacent-tags'
import { listArticlesByAdjacentTag, listArticlesByTag, listTagSummaries } from '@/lib/db/public-feed'

export default async function TagDetailPage({
  params,
}: {
  params: Promise<{ tagKey: string }>
}) {
  const { tagKey } = await params

  const [primaryTags, adjacentTags, directArticles, adjacentArticles] = isDatabaseConfigured()
    ? await Promise.all([
        listTagSummaries(18),
        listAdjacentTagSummaries(18),
        listArticlesByTag({ tagKey, limit: 30 }),
        listArticlesByAdjacentTag({ tagKey, limit: 30 }),
      ])
    : [[], [], [], []]

  const articles = directArticles.length > 0 ? directArticles : adjacentArticles
  const eyebrow = directArticles.length > 0 ? 'Primary Tag' : 'Adjacent Tag'
  const description =
    directArticles.length > 0
      ? `#${tagKey} に紐づく主タグ記事の一覧です。まず主タグ導線として成立するかを確認しやすい構成にしています。`
      : `#${tagKey} に紐づく周辺分野タグ記事の一覧です。当面は通常タグと同じ導線で見え方を評価します。`

  return (
    <PublicScaffold
      eyebrow={eyebrow}
      title={`#${tagKey}`}
      description={description}
      sidebar={<PublicDiscoveryRail primaryTags={primaryTags} adjacentTags={adjacentTags} />}
    >
      {articles.length > 0 ? (
        <PublicArticleList articles={articles} />
      ) : (
        <EmptyPanel message={`タグ「${tagKey}」に一致する記事はまだありません。`} />
      )}
    </PublicScaffold>
  )
}
