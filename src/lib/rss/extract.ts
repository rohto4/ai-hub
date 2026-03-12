import * as cheerio from 'cheerio'

/** 記事URLから本文テキストを抽出する */
export async function extractContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AITrendHub/1.0' },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) throw new Error(`fetch失敗 ${res.status}: ${url}`)

  const html = await res.text()
  return parseMainContent(html)
}

function parseMainContent(html: string): string {
  const $ = cheerio.load(html)

  // 不要要素を除去
  $('script, style, nav, footer, header, aside, .ad, .advertisement, .sns-share').remove()

  // 本文候補セレクタ（優先順）
  const SELECTORS = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-body',
    '.entry-content',
    '#content',
  ]

  for (const sel of SELECTORS) {
    const el = $(sel)
    if (el.length && el.text().trim().length > 200) {
      return cleanText(el.text())
    }
  }

  // フォールバック: body全体
  return cleanText($('body').text())
}

function cleanText(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 10_000) // 最大10000文字
}
