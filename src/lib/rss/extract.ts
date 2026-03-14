import * as cheerio from 'cheerio'

export async function extractContent(url: string): Promise<string> {
  const html = await fetchArticleHtml(url)
  return parseMainContent(html)
}

async function fetchArticleHtml(url: string): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          Referer: 'https://www.google.com/',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
      })

      const html = await res.text()

      if (!res.ok) {
        if (res.status === 403 && /cloudflare|attention required/i.test(html)) {
          throw new Error(`fetch blocked by cloudflare 403: ${url}`)
        }
        throw new Error(`fetch failed ${res.status}: ${url}`)
      }

      return html
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt === 1) {
        break
      }
    }
  }

  throw lastError ?? new Error(`fetch failed: ${url}`)
}

function parseMainContent(html: string): string {
  const $ = cheerio.load(html)

  $('script, style, nav, footer, header, aside, .ad, .advertisement, .sns-share, noscript, svg').remove()

  const selectors = [
    '#article-body',
    '[itemprop="articleBody"]',
    '[data-testid="article-body"]',
    '[data-component="text-block"]',
    '.caas-body',
    '.caas-content-wrapper',
    '.article-content__content',
    '.ArticleBody-articleBody',
    '.article-content',
    '.article__content',
    '.article-main',
    '.story-body',
    '.story-content',
    '.entry-body',
    '.post-body',
    '.article-text',
    '.content-body',
    '.main-content',
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-body',
    '.entry-content',
    '#content',
  ]

  const candidates: string[] = []

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const text = cleanText($(element).text())
      if (text.length > 200) {
        candidates.push(text)
      }
    })
  }

  const jsonLdCandidates = extractJsonLdCandidates($)
  for (const candidate of jsonLdCandidates) {
    if (candidate.length > 200) {
      candidates.push(candidate)
    }
  }

  const metaDescription = cleanText(
    $('meta[name="description"]').attr('content') ??
      $('meta[property="og:description"]').attr('content') ??
      '',
  )
  if (metaDescription.length > 120) {
    candidates.push(metaDescription)
  }

  const paragraphBundle = cleanText(
    $('p')
      .map((_, element) => $(element).text())
      .get()
      .join(' '),
  )
  if (paragraphBundle.length > 300) {
    candidates.push(paragraphBundle)
  }

  if (candidates.length > 0) {
    return candidates.sort((left, right) => right.length - left.length)[0]
  }

  return cleanText($('body').text())
}

function extractJsonLdCandidates($: cheerio.CheerioAPI): string[] {
  const candidates: string[] = []

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text().trim()
    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as unknown
      collectJsonLdText(parsed, candidates)
    } catch {
      // Ignore malformed ld+json blocks.
    }
  })

  return candidates.map(cleanText).filter((value) => value.length > 0)
}

function collectJsonLdText(value: unknown, candidates: string[]): void {
  if (!value) {
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectJsonLdText(entry, candidates))
    return
  }

  if (typeof value !== 'object') {
    return
  }

  const record = value as Record<string, unknown>
  const articleBody = typeof record.articleBody === 'string' ? record.articleBody : null
  const description = typeof record.description === 'string' ? record.description : null
  const type = typeof record['@type'] === 'string' ? record['@type'] : null

  if (articleBody && articleBody.length > 180) {
    candidates.push(articleBody)
  }

  if (description && description.length > 180 && type?.toLowerCase().includes('article')) {
    candidates.push(description)
  }

  if (record['@graph']) {
    collectJsonLdText(record['@graph'], candidates)
  }
}

function cleanText(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 10_000)
}
