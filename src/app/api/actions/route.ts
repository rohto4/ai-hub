import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { getSql, isDatabaseConfigured } from '@/lib/db'
import { ActionLogSchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

type HourlyDeltas = {
  impression: number
  open: number
  share: number
  save: number
  sourceOpen: number
}

const ZERO: HourlyDeltas = { impression: 0, open: 0, share: 0, save: 0, sourceOpen: 0 }

/**
 * action_type → activity_metrics_hourly の加算値マッピング。
 * ボタン追加/削除時はここだけ編集する。
 *
 * 集計対象外（意図的に無視）の action_type はコメントで明示しておく:
 *   share_open   … 共有モーダルを開いただけ（実際の share_copy が別途送られる）
 *   return_focus … visibilitychange によるフォーカス復帰（誤検知が多い）
 *   unsave       … 保存取り消し（save した事実はランキングシグナルとして保持）
 */
const ACTION_DELTA_MAP: Record<string, HourlyDeltas> = {
  // ── インプレッション ──────────────────────────────────────────
  view:             { ...ZERO, impression: 1 },

  // ── エンゲージメント（開封系） ─────────────────────────────────
  expand_200:       { ...ZERO, open: 1 },
  topic_group_open: { ...ZERO, open: 1 },
  digest_click:     { ...ZERO, open: 1 },

  // ── ソース記事へのアクセス ────────────────────────────────────
  article_open:     { ...ZERO, sourceOpen: 1 },

  // ── シェア ────────────────────────────────────────────────────
  // SNS 連携は廃止済み。テキストコピーのみ。
  share_copy:       { ...ZERO, share: 1 },

  // ── 保存 ──────────────────────────────────────────────────────
  save:             { ...ZERO, save: 1 },
}

function toHourlyDeltas(actionType: string): HourlyDeltas {
  return ACTION_DELTA_MAP[actionType] ?? ZERO
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
