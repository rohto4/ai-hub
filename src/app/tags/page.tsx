import Link from 'next/link'
import { EmptyPanel, PublicScaffold } from '@/components/site/PublicScaffold'
import { isDatabaseConfigured } from '@/lib/db'
import { listTagSummaries } from '@/lib/db/public-feed'

export default async function TagsPage() {
  const tags = isDatabaseConfigured() ? await listTagSummaries(80) : []

  return (
    <PublicScaffold title="タグ一覧" description="public_article_tags と tags_master から公開タグを集計表示します。">
      {tags.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <Link key={tag.tagKey} href={`/tags/${tag.tagKey}`} className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
              <div className="text-sm text-muted">#{tag.tagKey}</div>
              <div className="mt-1 text-lg font-extrabold">{tag.displayName}</div>
              <div className="mt-3 text-sm text-accent-dark">{tag.articleCount} 件</div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyPanel message="タグ集計を取得できませんでした。" />
      )}
    </PublicScaffold>
  )
}
