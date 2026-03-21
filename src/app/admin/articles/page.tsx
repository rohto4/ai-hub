import { AdminArticlesClient } from '@/components/admin/AdminArticlesClient'
import { getSql, isDatabaseConfigured } from '@/lib/db'
import type { AdminArticleRow } from '@/components/admin/AdminArticlesClient'

async function fetchArticles(): Promise<AdminArticleRow[]> {
  if (!isDatabaseConfigured()) return []
  const sql = getSql()
  const rows = (await sql`
    SELECT
      pa.public_article_id AS id,
      pa.public_key,
      pa.display_title AS title,
      pa.source_type,
      pa.source_category,
      pa.content_language,
      pa.visibility_status,
      pa.content_score,
      COALESCE(pa.original_published_at, pa.created_at) AS published_at
    FROM public_articles pa
    ORDER BY COALESCE(pa.original_published_at, pa.created_at) DESC
    LIMIT 200
  `) as AdminArticleRow[]
  return rows
}

export default async function AdminArticlesPage() {
  const articles = await fetchArticles()
  return <AdminArticlesClient initialArticles={articles} />
}
