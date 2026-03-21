import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSecret } from '@/lib/auth/admin'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { isDatabaseConfigured, getSql } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/admin/jobs/:id  - job の失敗 item 一覧（最大 100 件）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verifyAdminSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse()

  const { id } = await params
  const sql = getSql()

  const items = (await sql`
    SELECT
      jri.item_key,
      jri.item_status,
      jri.error_message,
      jri.detail,
      jri.created_at
    FROM job_run_items jri
    WHERE jri.job_run_id = ${Number(id)}
      AND jri.item_status = 'failed'
    ORDER BY jri.created_at DESC
    LIMIT 100
  `) as Array<{
    item_key: string
    item_status: string
    error_message: string | null
    detail: Record<string, unknown>
    created_at: string
  }>

  const totalItems = (await sql`
    SELECT COUNT(*) AS cnt FROM job_run_items WHERE job_run_id = ${Number(id)}
  `) as Array<{ cnt: string | number }>

  return NextResponse.json({
    jobRunId: Number(id),
    totalItems: Number(totalItems[0]?.cnt ?? 0),
    failedItems: items.map((item) => ({
      itemKey: item.item_key,
      status: item.item_status,
      errorMessage: item.error_message,
      detail: item.detail,
      createdAt: item.created_at,
    })),
  })
}
