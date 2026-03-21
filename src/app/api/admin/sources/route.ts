import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSecret } from '@/lib/auth/admin'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { isDatabaseConfigured } from '@/lib/db'
import { listAdminSources, setSourceActive, logAdminOperation } from '@/lib/db/admin-operations'

export const runtime = 'nodejs'

// GET /api/admin/sources  - ソース一覧
export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse()

  const sources = await listAdminSources()
  return NextResponse.json({ sources })
}

// PATCH /api/admin/sources  { sourceTargetId, isActive }
export async function PATCH(request: NextRequest) {
  if (!verifyAdminSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse()

  const body = (await request.json()) as { sourceTargetId?: string; isActive?: boolean }

  if (!body.sourceTargetId || typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'sourceTargetId and isActive required' }, { status: 400 })
  }

  const updated = await setSourceActive(body.sourceTargetId, body.isActive)
  if (!updated) {
    return NextResponse.json({ error: 'source not found' }, { status: 404 })
  }

  await logAdminOperation({
    operationType: body.isActive ? 'activate_source' : 'deactivate_source',
    targetKind: 'source_targets',
    targetId: body.sourceTargetId,
    payload: { isActive: body.isActive },
  })

  return NextResponse.json({ success: true, sourceTargetId: body.sourceTargetId, isActive: body.isActive })
}
