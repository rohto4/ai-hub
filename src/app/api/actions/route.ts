import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { getSql, isDatabaseConfigured } from '@/lib/db'
import { ActionLogSchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

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
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { article_id, action_type, session_id, platform, source, meta } = parsed.data
  const sql = getSql()

  const ua = request.headers.get('user-agent') ?? ''
  const detectedPlatform =
    platform ??
    (/mobile/i.test(ua) ? 'sp' : /tablet|ipad/i.test(ua) ? 'tb' : 'pc')

  await sql`
    INSERT INTO action_logs
      (article_id, action_type, session_id, platform, source, meta)
    VALUES
      (${article_id ?? null}, ${action_type}, ${session_id},
       ${detectedPlatform}, ${source ?? null}, ${meta ? JSON.stringify(meta) : null})
  `

  return NextResponse.json({ ok: true }, { status: 201 })
}
