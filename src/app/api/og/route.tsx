import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db'
import { getPublicArticleDetail } from '@/lib/db/public-feed'

export const runtime = 'edge'

const SOURCE_TYPE_BG: Record<string, string> = {
  official: '#1e40af',
  blog: '#065f46',
  paper: '#7c3aed',
  news: '#9a3412',
  alerts: '#1e3a5f',
}

export async function GET(request: NextRequest) {
  const publicKey = request.nextUrl.searchParams.get('publicKey')
  const appUrl = process.env.APP_URL ?? process.env.VERCEL_URL ?? 'http://localhost:3000'

  if (!publicKey || !isDatabaseConfigured()) {
    return defaultOgImage(appUrl)
  }

  try {
    const article = await getPublicArticleDetail(publicKey)
    if (!article) return defaultOgImage(appUrl)

    const bg = SOURCE_TYPE_BG[article.source_type] ?? '#1e3a5f'
    const summary = (article.summary_100 ?? '').slice(0, 120)
    const title = article.title.slice(0, 80)
    const tag = article.tags[0]?.displayName ?? article.source_type

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: bg,
            padding: '48px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* ヘッダー */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '18px' }}>AI Trend Hub</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px' }}>·</div>
            <div
              style={{
                color: 'white',
                fontSize: '14px',
                backgroundColor: 'rgba(255,255,255,0.15)',
                padding: '4px 12px',
                borderRadius: '999px',
              }}
            >
              #{tag}
            </div>
          </div>

          {/* タイトル */}
          <div
            style={{
              color: 'white',
              fontSize: title.length > 40 ? '36px' : '44px',
              fontWeight: 700,
              lineHeight: 1.3,
              flex: 1,
            }}
          >
            {title}
          </div>

          {/* サマリー */}
          {summary && (
            <div
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: '20px',
                lineHeight: 1.6,
                marginTop: '24px',
              }}
            >
              {summary}
            </div>
          )}

          {/* フッター */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '32px',
              paddingTop: '24px',
              borderTop: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>
              {article.source_type} · {article.content_language === 'ja' ? '日本語' : 'English'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>
              {article.published_at.toLocaleDateString('ja-JP')}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    )
  } catch {
    return defaultOgImage(appUrl)
  }
}

function defaultOgImage(_appUrl: string) {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#0f172a',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ color: 'white', fontSize: '48px', fontWeight: 700 }}>AI Trend Hub</div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
