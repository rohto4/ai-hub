import type { ContentLanguage, SourceType } from '@/lib/db/types'
import {
  resolveThumbnailTagRegistryEntry,
} from '@/lib/publish/thumbnail-tag-registry'

type SourceCategory = 'llm' | 'agent' | 'voice' | 'policy' | 'safety' | 'search' | 'news'

type MatchedTagReference = {
  tagKey: string
  displayName: string
}

type RankedTag = MatchedTagReference & {
  rank: number
  seed: number
}

type ThumbnailLayout = 'single' | 'dual' | 'trio' | 'overflow'

export type ThumbnailTemplateInput = {
  canonicalUrl: string
  title: string
  summary100: string
  summary200: string | null
  sourceType: SourceType
  sourceCategory: SourceCategory
  contentLanguage: ContentLanguage | null
  matchedTags: MatchedTagReference[]
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/[-]+/g, ' ')
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function slugifyTag(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
}

function buildSearchTerms(tag: MatchedTagReference): string[] {
  const normalizedDisplay = normalizeText(tag.displayName)
  const normalizedKey = normalizeText(tag.tagKey)
  const terms = new Set<string>([normalizedDisplay, normalizedKey])

  if (normalizedKey.includes('-')) {
    terms.add(normalizedKey.replace(/-/g, ' '))
  }

  return [...terms].filter((term) => term.length > 1)
}

function findEarliestIndex(text: string, terms: string[]): number | null {
  let best: number | null = null
  for (const term of terms) {
    const index = text.indexOf(term)
    if (index >= 0 && (best === null || index < best)) {
      best = index
    }
  }
  return best
}

function rankTags(input: ThumbnailTemplateInput): RankedTag[] {
  const title = normalizeText(input.title)
  const summary = normalizeText(input.summary200 ?? input.summary100)

  return input.matchedTags.map((tag) => {
    const terms = buildSearchTerms(tag)
    const titleIndex = findEarliestIndex(title, terms)
    const summaryIndex = titleIndex === null ? findEarliestIndex(summary, terms) : null
    const rank =
      titleIndex !== null
        ? titleIndex
        : summaryIndex !== null
          ? 10_000 + summaryIndex
          : 20_000

    return {
      ...tag,
      rank,
      seed: hashString(`${input.canonicalUrl}:${tag.tagKey}`),
    }
  })
}

function selectDisplayTags(input: ThumbnailTemplateInput): { tags: RankedTag[]; overflowCount: number } {
  const ranked = rankTags(input)
    .sort((left, right) => {
      if (left.rank !== right.rank) return left.rank - right.rank
      return left.seed - right.seed
    })

  const visible = ranked.slice(0, 3)
  const overflowCount = Math.max(0, ranked.length - visible.length)

  return { tags: visible, overflowCount }
}

function resolveBackground(sourceType: SourceType, sourceCategory: SourceCategory): string {
  if (sourceType === 'paper') return 'paper'
  if (sourceType === 'news') return 'news'
  if (sourceType === 'alerts') return 'alerts'
  if (sourceType === 'blog' && sourceCategory === 'llm') return 'blog-llm'
  if (sourceType === 'official' && sourceCategory === 'agent') return 'official-agent'
  if (sourceType === 'official' && sourceCategory === 'policy') return 'official-policy'
  return `${sourceType}-${sourceCategory}`
}

function resolveLayout(tagCount: number, overflowCount: number): ThumbnailLayout {
  if (overflowCount > 0) return 'overflow'
  if (tagCount <= 1) return 'single'
  if (tagCount === 2) return 'dual'
  return 'trio'
}

export function buildInternalThumbnailUrl(input: ThumbnailTemplateInput): string | null {
  const { tags, overflowCount } = selectDisplayTags(input)
  if (tags.length === 0) {
    return null
  }

  const background = resolveBackground(input.sourceType, input.sourceCategory)
  const layout = resolveLayout(tags.length, overflowCount)
  const variant = ['a', 'b', 'c'][hashString(input.canonicalUrl) % 3] ?? 'a'
  const encodedTags = tags.map((tag) => slugifyTag(tag.tagKey)).join(',')
  const params = new URLSearchParams({
    bg: background,
    layout,
    variant,
    tags: encodedTags,
    lang: input.contentLanguage ?? 'en',
  })

  if (overflowCount > 0) {
    params.set('overflow', String(overflowCount))
  }

  return `/api/thumb?${params.toString()}`
}

type RenderTag = {
  label: string
  fill: string
  color: string
}

type RenderPayload = {
  background: string
  layout: ThumbnailLayout
  variant: string
  tags: RenderTag[]
  language: ContentLanguage | null
  overflowCount: number
}

const BACKGROUNDS: Record<string, { start: string; end: string; accent: string }> = {
  paper: { start: '#f8fafc', end: '#cbd5e1', accent: '#0f172a' },
  news: { start: '#fef3c7', end: '#fb7185', accent: '#7c2d12' },
  alerts: { start: '#dbeafe', end: '#a78bfa', accent: '#312e81' },
  'blog-llm': { start: '#ecfccb', end: '#bef264', accent: '#365314' },
  'official-agent': { start: '#fee2e2', end: '#fb7185', accent: '#7f1d1d' },
  'official-policy': { start: '#e0e7ff', end: '#a5b4fc', accent: '#3730a3' },
  'official-llm': { start: '#cffafe', end: '#60a5fa', accent: '#0c4a6e' },
}

function renderTag(tagKey: string): RenderTag | null {
  const entry = resolveThumbnailTagRegistryEntry(tagKey)
  if (!entry) return null
  return {
    label: entry.shortLabel,
    fill: entry.accentColor,
    color: entry.accentTextColor ?? '#ffffff',
  }
}

export function decodeThumbnailPayload(searchParams: URLSearchParams): RenderPayload | null {
  const background = searchParams.get('bg')
  const layout = searchParams.get('layout') as ThumbnailLayout | null
  const variant = searchParams.get('variant') ?? 'a'
  const language = (searchParams.get('lang') as ContentLanguage | null) ?? null
  const overflowCount = Number(searchParams.get('overflow') ?? '0')
  const rawTags = searchParams.get('tags')

  if (!background || !layout || !rawTags) {
    return null
  }

  const tags = rawTags
    .split(',')
    .map((tagKey) => renderTag(tagKey))
    .filter((tag): tag is RenderTag => tag !== null)

  if (tags.length === 0) {
    return null
  }

  return { background, layout, variant, tags, language, overflowCount }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function renderBadgeText(payload: RenderPayload): string {
  return payload.language === 'ja' ? 'JP' : 'EN'
}

function renderChip(x: number, y: number, width: number, tag: RenderTag): string {
  return `
    <g transform="translate(${x} ${y})">
      <rect rx="9" ry="9" width="${width}" height="20" fill="${tag.fill}" />
      <text x="${width / 2}" y="13.5" fill="${tag.color}" font-size="8.5" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle">${escapeXml(tag.label)}</text>
    </g>
  `
}

export function renderThumbnailSvg(payload: RenderPayload): string {
  const background = BACKGROUNDS[payload.background] ?? BACKGROUNDS['official-llm']
  const chips = payload.tags.slice(0, 3)
  const chipWidths = chips.map((tag) => Math.max(34, Math.min(56, 18 + tag.label.length * 5)))
  const badge = renderBadgeText(payload)

  const chipMarkup =
    payload.layout === 'single'
      ? renderChip(13, 29, chipWidths[0] ?? 40, chips[0]!)
      : payload.layout === 'dual'
        ? `${renderChip(8, 22, chipWidths[0] ?? 40, chips[0]!)}${renderChip(22, 42, chipWidths[1] ?? 40, chips[1]!)}`
        : `${renderChip(6, 16, chipWidths[0] ?? 40, chips[0]!)}${renderChip(14, 37, chipWidths[1] ?? 40, chips[1]!)}${chips[2] ? renderChip(28, 56, chipWidths[2] ?? 40, chips[2]) : ''}`

  const overflowMarkup =
    payload.overflowCount > 0
      ? `<text x="48" y="68" fill="${background.accent}" font-size="10" font-family="Arial, sans-serif" font-weight="700" text-anchor="end">+${payload.overflowCount}</text>`
      : ''

  const accentCircle =
    payload.variant === 'a'
      ? '<circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.22)" />'
      : payload.variant === 'b'
        ? '<rect x="31" y="6" width="12" height="12" rx="6" fill="rgba(255,255,255,0.18)" />'
        : '<path d="M44 10 L54 22 L36 26 Z" fill="rgba(255,255,255,0.16)" />'

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="72" viewBox="0 0 56 72" role="img" aria-label="AI Trend Hub thumbnail">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${background.start}" />
          <stop offset="100%" stop-color="${background.end}" />
        </linearGradient>
      </defs>
      <rect width="56" height="72" rx="10" fill="url(#bg)" />
      ${accentCircle}
      <rect x="6" y="6" width="18" height="12" rx="6" fill="rgba(255,255,255,0.82)" />
      <text x="15" y="14.2" fill="${background.accent}" font-size="8" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle">${badge}</text>
      ${chipMarkup}
      ${overflowMarkup}
      <rect x="0" y="58" width="56" height="14" fill="rgba(255,255,255,0.2)" />
    </svg>
  `.trim()
}
