import * as cheerio from 'cheerio'

const PUBLISHER_SUFFIX_PATTERNS = [
  /\s[-|]\s[^-|]{2,60}$/,
  /\s[|｜]\s[^|｜]{2,60}$/,
]

function decodeHtml(value: string): string {
  return cheerio.load(`<div>${value}</div>`).text()
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function decodeAndNormalizeText(value: string): string {
  return normalizeWhitespace(decodeHtml(value))
}

function looksLikePublisherSuffix(value: string): boolean {
  const normalized = value.trim()
  if (!normalized) {
    return false
  }

  const wordCount = normalized.split(/\s+/).length
  return wordCount <= 6 && normalized.length <= 40
}

export function normalizeHeadline(rawTitle: string): string {
  let title = decodeAndNormalizeText(rawTitle)

  for (const pattern of PUBLISHER_SUFFIX_PATTERNS) {
    const match = title.match(pattern)
    if (!match) {
      continue
    }

    const suffix = match[0]
    const cleanedSuffix = suffix.replace(/^\s*[-|｜]\s*/, '')
    if (looksLikePublisherSuffix(cleanedSuffix)) {
      title = title.slice(0, title.length - suffix.length).trim()
    }
  }

  return title
}

const TITLE_SIGNATURE_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'from', 'into', 'over',
  'under', 'after', 'before', 'about', 'best', 'new', 'more', 'less', 'why',
  'how', 'what', 'when', 'could', 'would', 'should', 'can', 'now', 'its',
  'their', 'your', 'our', 'like', 'brief', 'part', 'pt', 'introducing',
])

export function buildHeadlineSignature(rawTitle: string): string {
  const normalized = normalizeHeadline(rawTitle)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !TITLE_SIGNATURE_STOPWORDS.has(token))

  return tokens.slice(0, 8).join(' ')
}
