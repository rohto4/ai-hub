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

function toArticle(row: PublicArticleRow): ArticleWithScore {
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
