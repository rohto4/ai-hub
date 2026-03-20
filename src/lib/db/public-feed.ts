import { getSql } from '@/lib/db'
import type {
  Article,
  ArticleWithScore,
  ContentLaneKey,
  ContentLanes,
  HomeActivity,
  HomeStats,
  RankBreakdown,
  RankPeriod,
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
  blog_count: number | string
  paper_count: number | string
  news_count: number | string
  top_rated_count: number | string
  agent_count: number | string
  voice_count: number | string
  policy_count: number | string
  safety_count: number | string
  search_count: number | string
}

type HomeActivityRow = {
  impression_count_last_hour: number | string
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

const PERIOD_INTERVAL: Record<RankPeriod, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
}

function toArticle(row: PublicArticleRow): ArticleWithScore {
  return {
    id: row.id,
    publicKey: row.public_key ?? undefined,
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

function buildGenreFilter(genre?: string | null): string | null {
  if (!genre || genre === 'all') return null
  return genre
}

function buildSourceTypeFilter(sourceType?: string | null): string | null {
  if (!sourceType || sourceType === 'all') return null
  return sourceType
}

/** ランキング順（public_rankings ベース） */
export async function listRankedPublicArticles(options: {
  period: RankPeriod
  genre?: string | null
  limit: number
  offset?: number
}): Promise<ArticleWithScore[]> {
  const sql = getSql()
  const rankingWindow = options.period
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

/** ランダム表示（期間内からランダム抽出） */
/** ランダム表示（1年以内の記事からランダム抽出） */
export async function listRandomPublicArticles(options: {
  limit: number
  genre?: string | null
}): Promise<ArticleWithScore[]> {
  const sql = getSql()
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
          AND COALESCE(pa.original_published_at, pa.created_at) >= now() - interval '1 year'
        ORDER BY RANDOM()
        LIMIT ${options.limit}
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
          AND COALESCE(pa.original_published_at, pa.created_at) >= now() - interval '1 year'
        ORDER BY RANDOM()
        LIMIT ${options.limit}
      `) as PublicArticleRow[])

  return rows.map(toArticle)
}

/** 最新順 */
export async function listLatestPublicArticles(options: {
  limit: number
  offset?: number
  genre?: string | null
  sourceType?: string | null
  period?: RankPeriod
}): Promise<ArticleWithScore[]> {
  const sql = getSql()
  const offset = options.offset ?? 0
  const genre = buildGenreFilter(options.genre)
  const sourceType = buildSourceTypeFilter(options.sourceType)
  const interval = options.period ? PERIOD_INTERVAL[options.period] : null

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
      AND COALESCE(pa.original_published_at, pa.created_at) >= now() - interval '1 year'
      AND (${interval}::text IS NULL OR COALESCE(pa.original_published_at, pa.created_at) >= now() - ${interval}::interval)
    ORDER BY COALESCE(pa.original_published_at, pa.created_at) DESC
    LIMIT ${options.limit}
    OFFSET ${offset}
  `) as PublicArticleRow[]

  return rows.map(toArticle)
}

/** ジャンル多様順（1年以内・source_category 毎に上位スコアを選出） */
export async function listUniquePublicArticles(options: {
  limit: number
  genre?: string | null
}): Promise<ArticleWithScore[]> {
  const sql = getSql()
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
          AND COALESCE(pa.original_published_at, pa.created_at) >= now() - interval '1 year'
        ORDER BY pa.source_category, pa.content_score DESC
        LIMIT ${options.limit}
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
          AND COALESCE(pa.original_published_at, pa.created_at) >= now() - interval '1 year'
        ORDER BY pa.source_category, pa.content_score DESC
        LIMIT ${options.limit}
      `) as PublicArticleRow[])

  return rows.map(toArticle)
}

/** コンテンツレーン（official / paper / news のみ、各 N 件） */
async function queryContentLaneArticles(options: {
  sourceType: ContentLaneKey
  period: RankPeriod
  limit: number
}): Promise<ArticleWithScore[]> {
  const sql = getSql()
  const interval = PERIOD_INTERVAL[options.period]

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
      AND pa.source_type = ${options.sourceType}
      AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${interval}::interval
    ORDER BY pa.content_score DESC, COALESCE(pa.original_published_at, pa.created_at) DESC
    LIMIT ${options.limit}
  `) as PublicArticleRow[]

  return rows.map(toArticle)
}

export async function listContentLanes(options: {
  period: RankPeriod
  perLane: number
}): Promise<ContentLanes> {
  const [official, paper, news] = await Promise.all([
    queryContentLaneArticles({ sourceType: 'official', period: options.period, limit: options.perLane }),
    queryContentLaneArticles({ sourceType: 'paper', period: options.period, limit: options.perLane }),
    queryContentLaneArticles({ sourceType: 'news', period: options.period, limit: options.perLane }),
  ])
  return { official, paper, news }
}

// 旧 listPublicArticlesLanes（後方互換 - 不要になったら削除）
export async function listPublicArticlesLanes(options: {
  period: RankPeriod
  perLane: number
}) {
  return listContentLanes(options)
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
      SELECT
        COALESCE(pas.source_key, st.source_key) AS source_key,
        COALESCE(pas.source_display_name, st.display_name) AS display_name,
        COALESCE(st.source_type, 'official') AS source_type
      FROM public_article_sources pas
      LEFT JOIN source_targets st ON st.source_target_id = pas.source_target_id
      WHERE pas.public_article_id = ${row.id}
      ORDER BY pas.is_primary DESC, pas.source_priority DESC
    `) as unknown as Promise<ArticleSourceRow[]>,
  ])

  const article = toArticle(row)
  return {
    ...article,
    publicKey: row.public_key,
    tags: tagRows.map((tag) => ({ tagKey: tag.tag_key, displayName: tag.display_name })),
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
        WHERE visibility_status = 'published'
          AND COALESCE(original_published_at, created_at) >= date_trunc('day', now())
      )::int AS published_today,
      COUNT(*) FILTER (WHERE visibility_status = 'published')::int AS published_total,
      COUNT(*) FILTER (WHERE visibility_status = 'published' AND source_type = 'official')::int AS official_count,
      COUNT(*) FILTER (WHERE visibility_status = 'published' AND source_type = 'blog')::int AS blog_count,
      COUNT(*) FILTER (WHERE visibility_status = 'published' AND source_type = 'paper')::int AS paper_count,
      COUNT(*) FILTER (WHERE visibility_status = 'published' AND source_type = 'news')::int AS news_count,
      COUNT(*) FILTER (
        WHERE visibility_status = 'published' AND content_score >= 90
      )::int AS top_rated_count,
      COUNT(*) FILTER (WHERE visibility_status = 'published' AND source_category = 'agent')::int AS agent_count,
      COUNT(*) FILTER (WHERE visibility_status = 'published' AND source_category = 'voice')::int AS voice_count,
      COUNT(*) FILTER (WHERE visibility_status = 'published' AND source_category = 'policy')::int AS policy_count,
      COUNT(*) FILTER (WHERE visibility_status = 'published' AND source_category = 'safety')::int AS safety_count,
      COUNT(*) FILTER (WHERE visibility_status = 'published' AND source_category = 'search')::int AS search_count
    FROM public_articles
  `) as HomeStatsRow[]

  return {
    publishedToday: Number(row?.published_today ?? 0),
    publishedTotal: Number(row?.published_total ?? 0),
    officialCount: Number(row?.official_count ?? 0),
    blogCount: Number(row?.blog_count ?? 0),
    paperCount: Number(row?.paper_count ?? 0),
    newsCount: Number(row?.news_count ?? 0),
    topRatedCount: Number(row?.top_rated_count ?? 0),
    agentCount: Number(row?.agent_count ?? 0),
    voiceCount: Number(row?.voice_count ?? 0),
    policyCount: Number(row?.policy_count ?? 0),
    safetyCount: Number(row?.safety_count ?? 0),
    searchCount: Number(row?.search_count ?? 0),
  }
}

export async function getHomeActivity(): Promise<HomeActivity> {
  const sql = getSql()
  const [row] = (await sql`
    SELECT
      COALESCE(SUM(impression_count), 0)::int AS impression_count_last_hour,
      COALESCE(SUM(share_count), 0)::int AS share_count_last_hour,
      COUNT(*) FILTER (
        WHERE impression_count > 0
           OR open_count > 0
           OR share_count > 0
           OR save_count > 0
           OR source_open_count > 0
      )::int AS active_articles_last_hour
    FROM activity_metrics_hourly
    WHERE hour_bucket >= date_trunc('hour', now()) - interval '1 hour'
  `) as HomeActivityRow[]

  return {
    impressionCountLastHour: Number(row?.impression_count_last_hour ?? 0),
    shareCountLastHour: Number(row?.share_count_last_hour ?? 0),
    activeArticlesLastHour: Number(row?.active_articles_last_hour ?? 0),
  }
}

export async function listDigestArticles(limit = 10): Promise<ArticleWithScore[]> {
  return listRankedPublicArticles({ period: '24h', limit })
}
