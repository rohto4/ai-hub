import { getSql } from '@/lib/db'
import type {
  Article,
  ArticleWithScore,
  HomeActivity,
  HomeStats,
  RankBreakdown,
  RankPeriod,
  RankingWindow,
} from '@/lib/db/types'

type PublicArticleRow = {
  id: string
  public_key?: string | null
  url: string
  title: string
  genre: Article['genre']
  source_type: Article['source_type']
  thumbnail_url: string | null
  thumbnail_emoji: string | null
  published_at: string
  summary_100: string | null
  summary_200: string | null
  critique: string | null
  publication_basis: Article['publication_basis']
  summary_input_basis: Article['summary_input_basis']
  topic_group_id: string | null
  created_at: string
  updated_at: string
  score: number | string
  breakdown: RankBreakdown | null
}

type HomeStatsRow = {
  published_today: number | string
  published_total: number | string
  official_count: number | string
  top_rated_count: number | string
}

type HomeActivityRow = {
  share_count_last_hour: number | string
  active_articles_last_hour: number | string
}

type DigestRow = {
  id: string
  title: string
  summary_100: string | null
}

type PublicTagRow = {
  tag_key: string
  display_name: string
  article_count: number | string
}

type ArticleTagRow = {
  tag_key: string
  display_name: string
  sort_order: number | string
}

type ArticleSourceRow = {
  source_key: string
  display_name: string
  source_type: Article['source_type']
}

export type PublicTagSummary = {
  tagKey: string
  displayName: string
  articleCount: number
}

export type PublicArticleDetail = ArticleWithScore & {
  publicKey: string
  tags: Array<{
    tagKey: string
    displayName: string
  }>
  sources: Array<{
    sourceKey: string
    displayName: string
    sourceType: Article['source_type']
  }>
}

function toArticle(row: PublicArticleRow): ArticleWithScore & { publicKey?: string } {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    genre: row.genre,
    source_type: row.source_type,
    thumbnail_url: row.thumbnail_url,
    thumbnail_emoji: row.thumbnail_emoji,
    published_at: new Date(row.published_at),
    summary_100: row.summary_100,
    summary_200: row.summary_200,
    critique: row.critique,
    publication_basis: row.publication_basis,
    summary_input_basis: row.summary_input_basis,
    topic_group_id: row.topic_group_id,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    score: Number(row.score),
    breakdown: row.breakdown ?? undefined,
    ...(row.public_key ? { publicKey: row.public_key } : {}),
  }
}

function mapPeriodToWindow(period: RankPeriod): RankingWindow {
  return period
}

function buildGenreFilter(genre?: string | null): string | null {
  if (!genre || genre === 'all') {
    return null
  }
  return genre
}

function buildSourceTypeFilter(sourceType?: string | null): string | null {
  if (!sourceType || sourceType === 'all') {
    return null
  }
  return sourceType
}

export async function listRankedPublicArticles(options: {
  period: RankPeriod
  genre?: string | null
  limit: number
  offset?: number
}): Promise<ArticleWithScore[]> {
  const sql = getSql()
  const rankingWindow = mapPeriodToWindow(options.period)
  const genre = buildGenreFilter(options.genre)
  const offset = options.offset ?? 0

  const rows = genre
    ? ((await sql`
        SELECT
          pa.public_article_id AS id,
          pa.public_key,
          pa.canonical_url AS url,
          pa.display_title AS title,
          pa.source_category AS genre,
          pa.source_type,
          pa.thumbnail_url,
          pa.thumbnail_emoji,
          COALESCE(pa.original_published_at, pa.created_at) AS published_at,
          pa.display_summary_100 AS summary_100,
          pa.display_summary_200 AS summary_200,
          pa.critique,
          pa.publication_basis,
          pa.summary_input_basis,
          NULL::text AS topic_group_id,
          pa.created_at,
          pa.updated_at,
          COALESCE(pr.score, pa.content_score) AS score,
          NULL::jsonb AS breakdown
        FROM public_articles pa
        LEFT JOIN public_rankings pr
          ON pr.public_article_id = pa.public_article_id
         AND pr.ranking_window = ${rankingWindow}
        WHERE pa.visibility_status = 'published'
          AND pa.source_category = ${genre}
        ORDER BY COALESCE(pr.rank_position, 999999) ASC,
                 COALESCE(pr.score, pa.content_score) DESC,
                 COALESCE(pa.original_published_at, pa.created_at) DESC
        LIMIT ${options.limit}
        OFFSET ${offset}
      `) as PublicArticleRow[])
    : ((await sql`
        SELECT
          pa.public_article_id AS id,
          pa.public_key,
          pa.canonical_url AS url,
          pa.display_title AS title,
          pa.source_category AS genre,
          pa.source_type,
          pa.thumbnail_url,
          pa.thumbnail_emoji,
          COALESCE(pa.original_published_at, pa.created_at) AS published_at,
          pa.display_summary_100 AS summary_100,
          pa.display_summary_200 AS summary_200,
          pa.critique,
          pa.publication_basis,
          pa.summary_input_basis,
          NULL::text AS topic_group_id,
          pa.created_at,
          pa.updated_at,
          COALESCE(pr.score, pa.content_score) AS score,
          NULL::jsonb AS breakdown
        FROM public_articles pa
        LEFT JOIN public_rankings pr
          ON pr.public_article_id = pa.public_article_id
         AND pr.ranking_window = ${rankingWindow}
        WHERE pa.visibility_status = 'published'
        ORDER BY COALESCE(pr.rank_position, 999999) ASC,
                 COALESCE(pr.score, pa.content_score) DESC,
                 COALESCE(pa.original_published_at, pa.created_at) DESC
        LIMIT ${options.limit}
        OFFSET ${offset}
      `) as PublicArticleRow[])

  return rows.map(toArticle)
}

export async function listLatestPublicArticles(options: {
  limit: number
  offset?: number
  genre?: string | null
  sourceType?: string | null
}): Promise<ArticleWithScore[]> {
  const sql = getSql()
  const offset = options.offset ?? 0
  const genre = buildGenreFilter(options.genre)
  const sourceType = buildSourceTypeFilter(options.sourceType)

  const rows = (await sql`
    SELECT
      pa.public_article_id AS id,
      pa.public_key,
      pa.canonical_url AS url,
      pa.display_title AS title,
      pa.source_category AS genre,
      pa.source_type,
      pa.thumbnail_url,
      pa.thumbnail_emoji,
      COALESCE(pa.original_published_at, pa.created_at) AS published_at,
      pa.display_summary_100 AS summary_100,
      pa.display_summary_200 AS summary_200,
      pa.critique,
      pa.publication_basis,
      pa.summary_input_basis,
      NULL::text AS topic_group_id,
      pa.created_at,
      pa.updated_at,
      pa.content_score AS score,
      NULL::jsonb AS breakdown
    FROM public_articles pa
    WHERE pa.visibility_status = 'published'
      AND (${genre}::text IS NULL OR pa.source_category = ${genre})
      AND (${sourceType}::text IS NULL OR pa.source_type = ${sourceType})
    ORDER BY COALESCE(pa.original_published_at, pa.created_at) DESC
    LIMIT ${options.limit}
    OFFSET ${offset}
  `) as PublicArticleRow[]

  return rows.map(toArticle)
}

export async function searchPublicArticles(options: {
  query: string
  genre?: string | null
  limit: number
  offset?: number
}): Promise<Article[]> {
  const sql = getSql()
  const offset = options.offset ?? 0
  const keyword = `%${options.query}%`
  const genre = buildGenreFilter(options.genre)

  const rows = genre
    ? ((await sql`
        SELECT
          pa.public_article_id AS id,
          pa.public_key,
          pa.canonical_url AS url,
          pa.display_title AS title,
          pa.source_category AS genre,
          pa.source_type,
          pa.thumbnail_url,
          pa.thumbnail_emoji,
          COALESCE(pa.original_published_at, pa.created_at) AS published_at,
          pa.display_summary_100 AS summary_100,
          pa.display_summary_200 AS summary_200,
          pa.critique,
          pa.publication_basis,
          pa.summary_input_basis,
          NULL::text AS topic_group_id,
          pa.created_at,
          pa.updated_at,
          pa.content_score AS score,
          NULL::jsonb AS breakdown
        FROM public_articles pa
        WHERE pa.visibility_status = 'published'
          AND pa.source_category = ${genre}
          AND (
            pa.display_title ILIKE ${keyword}
            OR COALESCE(pa.display_summary_100, '') ILIKE ${keyword}
            OR COALESCE(pa.display_summary_200, '') ILIKE ${keyword}
          )
        ORDER BY COALESCE(pa.original_published_at, pa.created_at) DESC
        LIMIT ${options.limit}
        OFFSET ${offset}
      `) as PublicArticleRow[])
    : ((await sql`
        SELECT
          pa.public_article_id AS id,
          pa.public_key,
          pa.canonical_url AS url,
          pa.display_title AS title,
          pa.source_category AS genre,
          pa.source_type,
          pa.thumbnail_url,
          pa.thumbnail_emoji,
          COALESCE(pa.original_published_at, pa.created_at) AS published_at,
          pa.display_summary_100 AS summary_100,
          pa.display_summary_200 AS summary_200,
          pa.critique,
          pa.publication_basis,
          pa.summary_input_basis,
          NULL::text AS topic_group_id,
          pa.created_at,
          pa.updated_at,
          pa.content_score AS score,
          NULL::jsonb AS breakdown
        FROM public_articles pa
        WHERE pa.visibility_status = 'published'
          AND (
            pa.display_title ILIKE ${keyword}
            OR COALESCE(pa.display_summary_100, '') ILIKE ${keyword}
            OR COALESCE(pa.display_summary_200, '') ILIKE ${keyword}
          )
        ORDER BY COALESCE(pa.original_published_at, pa.created_at) DESC
        LIMIT ${options.limit}
        OFFSET ${offset}
      `) as PublicArticleRow[])

  return rows.map(toArticle)
}

export async function listTagSummaries(limit = 50): Promise<PublicTagSummary[]> {
  const sql = getSql()
  const rows = (await sql`
    SELECT tm.tag_key, tm.display_name, COUNT(*)::int AS article_count
    FROM public_article_tags pat
    JOIN tags_master tm ON tm.tag_id = pat.tag_id
    JOIN public_articles pa ON pa.public_article_id = pat.public_article_id
    WHERE pa.visibility_status = 'published'
    GROUP BY tm.tag_key, tm.display_name
    ORDER BY article_count DESC, tm.display_name ASC
    LIMIT ${limit}
  `) as PublicTagRow[]

  return rows.map((row) => ({
    tagKey: row.tag_key,
    displayName: row.display_name,
    articleCount: Number(row.article_count),
  }))
}

export async function listArticlesByTag(options: {
  tagKey: string
  limit: number
  offset?: number
}): Promise<ArticleWithScore[]> {
  const sql = getSql()
  const offset = options.offset ?? 0

  const rows = (await sql`
    SELECT
      pa.public_article_id AS id,
      pa.public_key,
      pa.canonical_url AS url,
      pa.display_title AS title,
      pa.source_category AS genre,
      pa.source_type,
      pa.thumbnail_url,
      pa.thumbnail_emoji,
      COALESCE(pa.original_published_at, pa.created_at) AS published_at,
      pa.display_summary_100 AS summary_100,
      pa.display_summary_200 AS summary_200,
      pa.critique,
      pa.publication_basis,
      pa.summary_input_basis,
      NULL::text AS topic_group_id,
      pa.created_at,
      pa.updated_at,
      pa.content_score AS score,
      NULL::jsonb AS breakdown
    FROM public_articles pa
    JOIN public_article_tags pat ON pat.public_article_id = pa.public_article_id
    JOIN tags_master tm ON tm.tag_id = pat.tag_id
    WHERE pa.visibility_status = 'published'
      AND tm.tag_key = ${options.tagKey}
    ORDER BY COALESCE(pa.original_published_at, pa.created_at) DESC
    LIMIT ${options.limit}
    OFFSET ${offset}
  `) as PublicArticleRow[]

  return rows.map(toArticle)
}

export async function getPublicArticleDetail(publicKey: string): Promise<PublicArticleDetail | null> {
  const sql = getSql()
  const articleRows = (await sql`
    SELECT
      pa.public_article_id AS id,
      pa.public_key,
      pa.canonical_url AS url,
      pa.display_title AS title,
      pa.source_category AS genre,
      pa.source_type,
      pa.thumbnail_url,
      pa.thumbnail_emoji,
      COALESCE(pa.original_published_at, pa.created_at) AS published_at,
      pa.display_summary_100 AS summary_100,
      pa.display_summary_200 AS summary_200,
      pa.critique,
      pa.publication_basis,
      pa.summary_input_basis,
      NULL::text AS topic_group_id,
      pa.created_at,
      pa.updated_at,
      pa.content_score AS score,
      NULL::jsonb AS breakdown
    FROM public_articles pa
    WHERE pa.visibility_status = 'published'
      AND (pa.public_key = ${publicKey} OR pa.public_article_id::text = ${publicKey})
      LIMIT 1
  `) as Array<PublicArticleRow & { public_key: string }>

  const row = articleRows[0]
  if (!row) return null

  const [tagRows, sourceRows] = await Promise.all([
    (sql`
      SELECT tm.tag_key, tm.display_name, pat.sort_order
      FROM public_article_tags pat
      JOIN tags_master tm ON tm.tag_id = pat.tag_id
      WHERE pat.public_article_id = ${row.id}
      ORDER BY pat.sort_order ASC, tm.display_name ASC
    `) as unknown as Promise<ArticleTagRow[]>,
    (sql`
      SELECT st.source_key, st.display_name, st.source_type
      FROM public_article_sources pas
      JOIN source_targets st ON st.source_target_id = pas.source_target_id
      WHERE pas.public_article_id = ${row.id}
      ORDER BY pas.is_primary DESC, pas.source_priority DESC
    `) as unknown as Promise<ArticleSourceRow[]>,
  ])

  const article = toArticle(row)
  return {
    ...article,
    publicKey: row.public_key,
    tags: tagRows.map((tag) => ({
      tagKey: tag.tag_key,
      displayName: tag.display_name,
    })),
    sources: sourceRows.map((source) => ({
      sourceKey: source.source_key,
      displayName: source.display_name,
      sourceType: source.source_type,
    })),
  }
}

export async function listFeedArticles(limit = 20): Promise<ArticleWithScore[]> {
  return listLatestPublicArticles({ limit })
}

export async function getHomeStats(): Promise<HomeStats> {
  const sql = getSql()
  const [row] = (await sql`
    SELECT
      COUNT(*) FILTER (
        WHERE pa.visibility_status = 'published'
          AND COALESCE(pa.original_published_at, pa.created_at) >= date_trunc('day', now())
      ) AS published_today,
      COUNT(*) FILTER (WHERE pa.visibility_status = 'published') AS published_total,
      COUNT(*) FILTER (
        WHERE pa.visibility_status = 'published'
          AND pa.source_type = 'official'
      ) AS official_count,
      COUNT(*) FILTER (
        WHERE pa.visibility_status = 'published'
          AND pa.content_score >= 90
      ) AS top_rated_count
    FROM public_articles pa
  `) as HomeStatsRow[]

  return {
    publishedToday: Number(row?.published_today ?? 0),
    publishedTotal: Number(row?.published_total ?? 0),
    officialCount: Number(row?.official_count ?? 0),
    topRatedCount: Number(row?.top_rated_count ?? 0),
  }
}

export async function getHomeActivity(): Promise<HomeActivity> {
  const sql = getSql()
  const [row] = (await sql`
    SELECT
      COALESCE(SUM(share_count), 0) AS share_count_last_hour,
      COUNT(*) FILTER (
        WHERE impression_count > 0
           OR open_count > 0
           OR share_count > 0
           OR save_count > 0
           OR source_open_count > 0
      ) AS active_articles_last_hour
    FROM activity_metrics_hourly
    WHERE hour_bucket >= date_trunc('hour', now()) - interval '1 hour'
  `) as HomeActivityRow[]

  return {
    shareCountLastHour: Number(row?.share_count_last_hour ?? 0),
    activeArticlesLastHour: Number(row?.active_articles_last_hour ?? 0),
  }
}

export async function listDigestArticles(limit = 3): Promise<DigestRow[]> {
  const sql = getSql()

  return (await sql`
    SELECT
      pa.public_article_id AS id,
      pa.display_title AS title,
      pa.display_summary_100 AS summary_100
    FROM public_articles pa
    LEFT JOIN public_rankings pr
      ON pr.public_article_id = pa.public_article_id
     AND pr.ranking_window = '24h'
    WHERE pa.visibility_status = 'published'
    ORDER BY COALESCE(pr.rank_position, 999999) ASC,
             COALESCE(pr.score, pa.content_score) DESC,
             COALESCE(pa.original_published_at, pa.created_at) DESC
    LIMIT ${limit}
  `) as DigestRow[]
}
