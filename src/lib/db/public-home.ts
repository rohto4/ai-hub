import { getSql } from '@/lib/db'
import type { HomeActivity, HomeStats } from '@/lib/db/types'
import { HomeActivityRow, HomeStatsRow, mapHomeActivity, mapHomeStats } from '@/lib/db/public-shared'

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
      COUNT(*) FILTER (WHERE visibility_status = 'published' AND source_category = 'search')::int AS search_count,
      COUNT(*) FILTER (WHERE visibility_status = 'published' AND content_language = 'ja')::int AS ja_count,
      COUNT(*) FILTER (WHERE visibility_status = 'published' AND content_language = 'en')::int AS en_count
    FROM public_articles
  `) as HomeStatsRow[]

  return mapHomeStats(row)
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

  return mapHomeActivity(row)
}
