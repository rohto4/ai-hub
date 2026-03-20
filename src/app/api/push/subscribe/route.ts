import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { getSql, isDatabaseConfigured } from '@/lib/db'
import { PushSubscribeSchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const parsed = PushSubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const sql = getSql()
  const { session_id, endpoint, keys, sourceCategories } = parsed.data

  await sql`
    INSERT INTO push_subscriptions (session_id, endpoint, keys, genres, active)
    VALUES (${session_id}, ${endpoint}, ${JSON.stringify(keys)}, ${sourceCategories}, true)
    ON CONFLICT (endpoint)
    DO UPDATE SET
      session_id = EXCLUDED.session_id,
      keys = EXCLUDED.keys,
      genres = EXCLUDED.genres,
      active = true
  `

  return NextResponse.json({ ok: true }, { status: 201 })
}
