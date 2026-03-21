import { PublicArticleList } from '@/components/site/PublicArticleList'
import { EmptyPanel, PublicScaffold } from '@/components/site/PublicScaffold'
import { isDatabaseConfigured } from '@/lib/db'
import { listRankedPublicArticles } from '@/lib/db/public-feed'

export default async function RankingPage() {
  const articles = isDatabaseConfigured() ? await listRankedPublicArticles({ period: '24h', sourceCategory: 'all', limit: 30 }) : []

  return (
    <PublicScaffold title="ランキング" description="アクティビティと記事スコアに基づいた 24 時間のトレンドランキングです。">
      {articles.length > 0 ? <PublicArticleList articles={articles} showRank /> : <EmptyPanel message="公開ランキングを表示できませんでした。" />}
    </PublicScaffold>
  )
}
