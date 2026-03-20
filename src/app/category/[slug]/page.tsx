import { PublicArticleList } from '@/components/site/PublicArticleList'
import { EmptyPanel, PublicScaffold } from '@/components/site/PublicScaffold'
import { isDatabaseConfigured } from '@/lib/db'
import { listLatestPublicArticles, listRankedPublicArticles } from '@/lib/db/public-feed'

const SOURCE_TYPES = new Set(['official', 'blog', 'paper', 'news', 'alerts', 'video'])
const TOPICS = new Set(['llm', 'agent', 'voice', 'policy', 'safety', 'search', 'news'])

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const sourceType = SOURCE_TYPES.has(slug) ? slug : null
  const sourceCategory = !sourceType && TOPICS.has(slug) ? slug : 'all'
  const articles = isDatabaseConfigured()
    ? sourceType
      ? await listLatestPublicArticles({ limit: 30, sourceType })
      : await listRankedPublicArticles({ period: '24h', sourceCategory, limit: 30 })
    : []

  return (
    <PublicScaffold title={`カテゴリ: ${slug}`} description="source_type または source_category を slug として受けるカテゴリページです。">
      {articles.length > 0 ? (
        <PublicArticleList articles={articles} showRank={!sourceType} />
      ) : (
        <EmptyPanel message={`カテゴリ「${slug}」に一致する記事はありません。`} />
      )}
    </PublicScaffold>
  )
}
