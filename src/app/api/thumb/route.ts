import { NextRequest, NextResponse } from 'next/server'
import { decodeThumbnailPayload, renderThumbnailSvg } from '@/lib/publish/thumbnail-template'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const payload = decodeThumbnailPayload(request.nextUrl.searchParams)
  if (!payload) {
    return new NextResponse('invalid thumbnail payload', { status: 400 })
  }

  return new NextResponse(renderThumbnailSvg(payload), {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
