import { NextRequest, NextResponse } from 'next/server'
import { getAdminPagePath, isSafeAdminRedirectPath } from '@/lib/admin-path'

export const runtime = 'nodejs'

// POST /api/admin/login { secret }
// ADMIN_SECRET が合えば admin_session cookie をセットして redirect
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { secret?: string; redirect?: string }
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || body.secret !== adminSecret) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }

  const requestedRedirect = body.redirect ?? getAdminPagePath()
  const redirectTo = isSafeAdminRedirectPath(requestedRedirect) ? requestedRedirect : getAdminPagePath()
  const response = NextResponse.json({ success: true, redirect: redirectTo })
  response.cookies.set('admin_session', adminSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
  return response
}

// DELETE /api/admin/login  - ログアウト
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('admin_session')
  return response
}
