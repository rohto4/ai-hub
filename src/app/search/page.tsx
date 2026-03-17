import { PublicArticleList } from '@/components/site/PublicArticleList'
import { EmptyPanel, PublicScaffold } from '@/components/site/PublicScaffold'
import { isDatabaseConfigured } from '@/lib/db'
import { searchPublicArticles } from '@/lib/db/public-feed'

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  const articles = isDatabaseConfigured() && q ? await searchPublicArticles({ query: q, limit: 30 }) : []

  return (
    <PublicScaffold title="検索" description="L4 の公開記事を title / summary から検索します。">
      <form className="mb-6 rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="OpenAI / Agent / Gemini"
            className="flex-1 rounded-2xl border border-black/10 px-4 py-3 outline-none"
          />
          <button className="rounded-2xl bg-btn-dark px-5 py-3 font-bold text-white" type="submit">
            検索
          </button>
        </div>
      </form>

      {q ? (
        articles.length > 0 ? (
          <PublicArticleList articles={articles} />
        ) : (
          <EmptyPanel message={`「${q}」に一致する公開記事はありません。`} />
        )
      ) : (
        <EmptyPanel message="検索語を入力してください。" />
      )}
    </PublicScaffold>
  )
}
