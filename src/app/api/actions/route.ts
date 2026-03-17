import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { getSql, isDatabaseConfigured } from '@/lib/db'
import { ActionLogSchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

function toHourlyDeltas(actionType: string): {
  impression: number
  open: number
  share: number
  save: number
  sourceOpen: number
} {
  switch (actionType) {
    case 'view':
      return { impression: 1, open: 0, share: 0, save: 0, sourceOpen: 0 }
    case 'expand_200':
    case 'topic_group_open':
    case 'digest_click':
      return { impression: 0, open: 1, share: 0, save: 0, sourceOpen: 0 }
    case 'article_open':
      return { impression: 0, open: 0, share: 0, save: 0, sourceOpen: 1 }
    case 'share_copy':
    case 'share_x':
    case 'share_threads':
    case 'share_slack':
    case 'share_misskey':
      return { impression: 0, open: 0, share: 1, save: 0, sourceOpen: 0 }
    case 'save':
      return { impression: 0, open: 0, share: 0, save: 1, sourceOpen: 0 }
    default:
      return { impression: 0, open: 0, share: 0, save: 0, sourceOpen: 0 }
  }
}

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const parsed = ActionLogSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { article_id, action_type, session_id, platform, source, meta } = parsed.data
  const sql = getSql()
  const ua = request.headers.get('user-agent') ?? ''
  const detectedPlatform =
    platform ??
    (/mobile/i.test(ua) ? 'sp' : /tablet|ipad/i.test(ua) ? 'tb' : 'pc')

  await sql`
    INSERT INTO activity_logs
      (public_article_id, action_type, session_id, platform, referrer_type, payload)
    VALUES
      (
        ${article_id ?? null},
        ${action_type},
        ${session_id},
        ${detectedPlatform},
        ${source ?? null},
        ${meta ? JSON.stringify(meta) : JSON.stringify({})}::jsonb
      )
  `

  if (article_id) {
    const deltas = toHourlyDeltas(action_type)
    if (Object.values(deltas).some((value) => value > 0)) {
      await sql`
        INSERT INTO activity_metrics_hourly (
          public_article_id,
          hour_bucket,
          impression_count,
          open_count,
          share_count,
          save_count,
          source_open_count
        )
        VALUES (
          ${article_id},
          date_trunc('hour', now()),
          ${deltas.impression},
          ${deltas.open},
          ${deltas.share},
          ${deltas.save},
          ${deltas.sourceOpen}
        )
        ON CONFLICT (public_article_id, hour_bucket) DO UPDATE SET
          impression_count = activity_metrics_hourly.impression_count + EXCLUDED.impression_count,
          open_count = activity_metrics_hourly.open_count + EXCLUDED.open_count,
          share_count = activity_metrics_hourly.share_count + EXCLUDED.share_count,
          save_count = activity_metrics_hourly.save_count + EXCLUDED.save_count,
          source_open_count = activity_metrics_hourly.source_open_count + EXCLUDED.source_open_count,
          updated_at = now()
      `
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
