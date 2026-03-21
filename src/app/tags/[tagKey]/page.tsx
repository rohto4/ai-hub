import { PublicArticleList } from '@/components/site/PublicArticleList'
import { EmptyPanel, PublicScaffold } from '@/components/site/PublicScaffold'
import { isDatabaseConfigured } from '@/lib/db'
import { listArticlesByTag } from '@/lib/db/public-feed'

export default async function TagDetailPage({
  params,
}: {
  params: Promise<{ tagKey: string }>
}) {
  const { tagKey } = await params
  const articles = isDatabaseConfigured() ? await listArticlesByTag({ tagKey, limit: 30 }) : []

  return (
    <PublicScaffold title={`#${tagKey}`} description={`「${tagKey}」に関連するAI記事の一覧です。`}>
      {articles.length > 0 ? <PublicArticleList articles={articles} /> : <EmptyPanel message={`タグ「${tagKey}」に一致する記事はありません。`} />}
    </PublicScaffold>
  )
}
