import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { verifyAdminSecret } from '@/lib/auth/admin'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { isDatabaseConfigured } from '@/lib/db'
import { hidePublicArticle, unhidePublicArticle, logAdminOperation } from '@/lib/db/admin-operations'

export const runtime = 'nodejs'

// PATCH /api/admin/articles/:id  { action: 'hide' | 'unhide' }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verifyAdminSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const { id } = await params
  const body = (await request.json()) as { action?: string }
  const action = body.action

  if (action !== 'hide' && action !== 'unhide') {
    return NextResponse.json({ error: 'action must be hide or unhide' }, { status: 400 })
  }

  const updated =
    action === 'hide' ? await hidePublicArticle(id) : await unhidePublicArticle(id)

  if (!updated) {
    return NextResponse.json({ error: 'article not found or already in target state' }, { status: 404 })
  }

  await logAdminOperation({
    operationType: action === 'hide' ? 'hide_article' : 'unhide_article',
    targetKind: 'public_article',
    targetId: id,
    payload: { action },
  })

  // Next.js on-demand revalidation
  revalidatePath(`/articles/[publicKey]`, 'page')

  return NextResponse.json({ success: true, id, action })
}
