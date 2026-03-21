import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSecret } from '@/lib/auth/admin'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { isDatabaseConfigured } from '@/lib/db'
import {
  listTagCandidates,
  promoteTagToMaster,
  addTagKeyword,
  logAdminOperation,
} from '@/lib/db/admin-operations'

export const runtime = 'nodejs'

// GET /api/admin/tags?type=candidates  - タグ候補一覧
export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse()

  const type = request.nextUrl.searchParams.get('type') ?? 'candidates'
  if (type === 'candidates') {
    const candidates = await listTagCandidates(200)
    return NextResponse.json({ candidates })
  }

  return NextResponse.json({ error: 'unknown type' }, { status: 400 })
}

// POST /api/admin/tags  - タグ昇格 or キーワード追加
// promote: { action: 'promote', tagKey, displayName }
// keyword: { action: 'add_keyword', tagId, keyword }
export async function POST(request: NextRequest) {
  if (!verifyAdminSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse()

  const body = (await request.json()) as {
    action?: string
    tagKey?: string
    displayName?: string
    tagId?: string
    keyword?: string
  }

  if (body.action === 'promote') {
    if (!body.tagKey || !body.displayName) {
      return NextResponse.json({ error: 'tagKey and displayName required' }, { status: 400 })
    }
    const tagId = await promoteTagToMaster(body.tagKey, body.displayName)
    await logAdminOperation({
      operationType: 'promote_tag',
      targetKind: 'tag_candidate_pool',
      targetId: body.tagKey,
      payload: { tagKey: body.tagKey, displayName: body.displayName, newTagId: tagId },
    })
    return NextResponse.json({ success: true, tagId, tagKey: body.tagKey })
  }

  if (body.action === 'add_keyword') {
    if (!body.tagId || !body.keyword) {
      return NextResponse.json({ error: 'tagId and keyword required' }, { status: 400 })
    }
    await addTagKeyword(body.tagId, body.keyword)
    await logAdminOperation({
      operationType: 'add_tag_keyword',
      targetKind: 'tags_master',
      targetId: body.tagId,
      payload: { keyword: body.keyword },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
