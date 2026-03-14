import { getSql } from '@/lib/db'
import type { SourceTarget } from '@/lib/collectors/types'

type SourceTargetRow = {
  id: string
  source_key: string
  display_name: string
  fetch_kind: SourceTarget['fetchKind']
  source_category: string
  base_url: string | null
  fetch_interval_minutes: number
  supports_update_detection: boolean
  requires_auth: boolean
}

export async function listDueSourceTargets(limit = 20): Promise<SourceTarget[]> {
  const sql = getSql()
  const rows = (await sql`
    SELECT
      st.id,
      st.source_key,
      st.display_name,
      st.fetch_kind,
      st.source_category,
      st.base_url,
      st.fetch_interval_minutes,
      st.supports_update_detection,
      st.requires_auth
    FROM source_targets st
    LEFT JOIN LATERAL (
      SELECT MAX(ar.fetch_run_at) AS last_fetch_run_at
      FROM articles_raw ar
      WHERE ar.source_target_id = st.id
    ) latest_fetch ON true
    WHERE st.is_active = true
      AND st.fetch_kind IN ('rss', 'alerts')
      AND (
        latest_fetch.last_fetch_run_at IS NULL
        OR latest_fetch.last_fetch_run_at <= now() - (st.fetch_interval_minutes * interval '1 minute')
      )
    ORDER BY latest_fetch.last_fetch_run_at ASC NULLS FIRST, st.display_name ASC
    LIMIT ${limit}
  `) as SourceTargetRow[]

  return rows.map((row) => ({
    id: row.id,
    sourceKey: row.source_key,
    displayName: row.display_name,
    fetchKind: row.fetch_kind,
    sourceCategory: row.source_category,
    baseUrl: row.base_url,
    fetchIntervalMinutes: row.fetch_interval_minutes,
    supportsUpdateDetection: row.supports_update_detection,
    requiresAuth: row.requires_auth,
  }))
}
