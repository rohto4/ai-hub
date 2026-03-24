import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSecret } from '@/lib/auth/admin'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { isDatabaseConfigured } from '@/lib/db'
import {
  listTagCandidates,
  promoteTagToMaster,
  addTagKeyword,
  setTagCandidateStatus,
  logAdminOperation,
} from '@/lib/db/admin-operations'

export const runtime = 'nodejs'

// GET /api/admin/tags?status=candidate|manual_review
export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse()

  const statusParam = request.nextUrl.searchParams.get('status') ?? 'candidate'
  const status = statusParam === 'manual_review' ? 'manual_review' : 'candidate'
  const candidates = await listTagCandidates(200, status)
  return NextResponse.json({ candidates, status })
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
    const {
      tagId,
      normalizedTagKey,
      taggedEnrichedCount,
      taggedPublicCount,
      hasThumbnailAsset,
    } = await promoteTagToMaster(body.tagKey, body.displayName)
    await logAdminOperation({
      operationType: 'promote_tag',
      targetKind: 'tag_candidate_pool',
      targetId: body.tagKey,
      payload: {
        tagKey: body.tagKey,
        normalizedTagKey,
        displayName: body.displayName,
        newTagId: tagId,
        taggedEnrichedCount,
        taggedPublicCount,
        hasThumbnailAsset,
      },
    })
    return NextResponse.json({
      success: true,
      tagId,
      tagKey: body.tagKey,
      normalizedTagKey,
      taggedEnrichedCount,
      taggedPublicCount,
      hasThumbnailAsset,
    })
  }

  if (body.action === 'hold' || body.action === 'reject' || body.action === 'restore') {
    if (!body.tagKey) {
      return NextResponse.json({ error: 'tagKey required' }, { status: 400 })
    }
    const newStatus = body.action === 'hold' ? 'manual_review'
      : body.action === 'reject' ? 'rejected'
      : 'candidate'
    await setTagCandidateStatus(body.tagKey, newStatus as 'candidate' | 'manual_review' | 'rejected')
    await logAdminOperation({
      operationType: body.action === 'hold' ? 'hold_tag' : 'reject_tag',
      targetKind: 'tag_candidate_pool',
      targetId: body.tagKey,
      payload: { tagKey: body.tagKey, newStatus },
    })
    return NextResponse.json({ success: true, tagKey: body.tagKey, status: newStatus })
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
