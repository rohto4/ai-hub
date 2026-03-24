import type { ContentLanguage, SourceType } from '@/lib/db/types'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
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
const THUMBNAIL_TEMPLATE_VERSION = '3'
const EXCLUDED_THUMBNAIL_TAGS = new Set(['llm'])

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
    .filter((tag) => !EXCLUDED_THUMBNAIL_TAGS.has(tag.tagKey))
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

  const registeredTags = tags.filter((tag) => {
    const entry = resolveThumbnailTagRegistryEntry(tag.tagKey)
    return Boolean(entry?.iconPath)
  })
  if (registeredTags.length === 0) {
    return null
  }

  const background = resolveBackground(input.sourceType, input.sourceCategory)
  const layout = resolveLayout(registeredTags.length, overflowCount)
  const variant = ['a', 'b', 'c'][hashString(input.canonicalUrl) % 3] ?? 'a'
  const encodedTags = registeredTags.map((tag) => slugifyTag(tag.tagKey)).join(',')
  const params = new URLSearchParams({
    bg: background,
    layout,
    variant,
    tags: encodedTags,
    lang: input.contentLanguage ?? 'en',
    v: THUMBNAIL_TEMPLATE_VERSION,
  })

  const adjustedOverflowCount = Math.max(0, input.matchedTags.length - registeredTags.length)
  if (adjustedOverflowCount > 0) {
    params.set('overflow', String(adjustedOverflowCount))
  }

  return `/api/thumb?${params.toString()}`
}

type RenderTag = {
  fill: string
  iconHref?: string
  highQualityAssetHref?: string
  fallbackShape: 'ring' | 'diamond' | 'triangle' | 'orb'
}

type RenderPayload = {
  background: string
  layout: ThumbnailLayout
  variant: string
  tags: RenderTag[]
  language: ContentLanguage | null
  overflowCount: number
}

const BACKGROUNDS: Record<string, { start: string; end: string; accent: string; texture?: string }> = {
  paper: { start: '#f8fafc', end: '#cbd5e1', accent: '#0f172a' },
  news: { start: '#fef3c7', end: '#fb7185', accent: '#7c2d12' },
  alerts: { start: '#dbeafe', end: '#a78bfa', accent: '#312e81' },
  'blog-llm': { start: '#ecfccb', end: '#bef264', accent: '#365314' },
  'official-agent': { start: '#fee2e2', end: '#fb7185', accent: '#7f1d1d' },
  'official-policy': { start: '#e0e7ff', end: '#a5b4fc', accent: '#3730a3' },
  'official-llm': { start: '#cffafe', end: '#60a5fa', accent: '#0c4a6e' },
}

const assetDataUriCache = new Map<string, string>()

function loadAssetDataUri(assetPath: string, mimeType = 'image/svg+xml'): string | null {
  const cached = assetDataUriCache.get(assetPath)
  if (cached) return cached

  const absolutePath = path.join(process.cwd(), 'public', assetPath.replace(/^\//, ''))
  if (!existsSync(absolutePath)) return null

  const buffer = readFileSync(absolutePath)
  const isSvg = assetPath.endsWith('.svg')
  const actualMime = isSvg ? 'image/svg+xml;charset=utf-8' : assetPath.endsWith('.webp') ? 'image/webp' : 'image/png'
  const base64 = buffer.toString('base64')
  const dataUri = `data:${actualMime};base64,${base64}`
  assetDataUriCache.set(assetPath, dataUri)
  return dataUri
}

function renderTag(tagKey: string): RenderTag | null {
  const entry = resolveThumbnailTagRegistryEntry(tagKey)
  if (!entry) return null
  const shapes: RenderTag['fallbackShape'][] = ['ring', 'diamond', 'triangle', 'orb']
  const fallbackShape = shapes[hashString(tagKey) % shapes.length] ?? 'orb'
  return {
    fill: entry.accentColor,
    iconHref: entry.iconPath ? loadAssetDataUri(entry.iconPath) ?? undefined : undefined,
    highQualityAssetHref: entry.highQualityAssetPath ? loadAssetDataUri(entry.highQualityAssetPath) ?? undefined : undefined,
    fallbackShape,
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

function renderBadgeText(payload: RenderPayload): string {
  return payload.language === 'ja' ? 'JP' : 'EN'
}

function renderFallbackGlyph(tag: RenderTag, size: number): string {
  if (tag.fallbackShape === 'ring') {
    return `
      <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.22}" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="${Math.max(1.5, size * 0.1)}" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.08}" fill="rgba(255,255,255,0.92)" />
    `
  }
  if (tag.fallbackShape === 'diamond') {
    return `<rect x="${size * 0.28}" y="${size * 0.28}" width="${size * 0.44}" height="${size * 0.44}" rx="${size * 0.08}" transform="rotate(45 ${size / 2} ${size / 2})" fill="rgba(255,255,255,0.92)" />`
  }
  if (tag.fallbackShape === 'triangle') {
    return `<path d="M ${size / 2} ${size * 0.22} L ${size * 0.76} ${size * 0.72} L ${size * 0.24} ${size * 0.72} Z" fill="rgba(255,255,255,0.92)" />`
  }
  return `<circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.24}" fill="rgba(255,255,255,0.92)" />`
}

function renderIconTile(x: number, y: number, size: number, tag: RenderTag, tilt = 0): string {
  if (tag.highQualityAssetHref) {
    // Bleeding out large SVG rendering
    return `
      <g transform="translate(${x} ${y}) rotate(${tilt} ${size / 2} ${size / 2})" style="filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.4))">
        <image x="0" y="0" width="${size}" height="${size}" href="${tag.highQualityAssetHref}" preserveAspectRatio="xMidYMid meet" />
      </g>
    `
  }

  // Fallback for missing assets
  const iconInset = size * 0.15
  const iconSize = size - iconInset * 2
  const mainImage = tag.iconHref
    ? `<image x="${iconInset}" y="${iconInset}" width="${iconSize}" height="${iconSize}" href="${tag.iconHref}" preserveAspectRatio="xMidYMid meet" />`
    : renderFallbackGlyph(tag, size)

  return `
    <g transform="translate(${x} ${y}) rotate(${tilt} ${size / 2} ${size / 2})">
      <rect x="2" y="${size * 0.12}" width="${size}" height="${size}" rx="${Math.max(8, size * 0.35)}" fill="rgba(0,0,0,0.2)" />
      <rect width="${size}" height="${size}" rx="${Math.max(8, size * 0.35)}" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" />
      <rect x="2" y="2" width="${size - 4}" height="${size * 0.45}" rx="${Math.max(6, size * 0.25)}" fill="rgba(255,255,255,0.18)" />
      <g>
        <rect x="${size * 0.18}" y="${size * 0.18}" width="${size * 0.64}" height="${size * 0.64}" rx="${Math.max(5, size * 0.22)}" fill="${tag.fill}" opacity="0.8" />
        ${mainImage}
      </g>
    </g>
  `
}

function renderOverflowDots(x: number, y: number): string {
  return `
    <g transform="translate(${x} ${y})">
      <circle cx="4" cy="4" r="2.5" fill="white" />
      <circle cx="12" cy="4" r="2" fill="rgba(255,255,255,0.7)" />
      <circle cx="18" cy="4" r="1.5" fill="rgba(255,255,255,0.45)" />
    </g>
  `
}

export function renderThumbnailSvg(payload: RenderPayload): string {
  const background = BACKGROUNDS[payload.background] ?? BACKGROUNDS['official-llm']
  const chips = payload.tags.slice(0, 3)
  const badge = renderBadgeText(payload)

  let chipMarkup = ''
  if (chips.length === 1) {
    chipMarkup = renderIconTile(4, 14, 48, chips[0]!, -4)
  } else if (chips.length === 2) {
    chipMarkup = `${renderIconTile(-6, 8, 38, chips[0]!, -10)}${renderIconTile(20, 24, 38, chips[1]!, 8)}`
  } else if (chips.length >= 3) {
    chipMarkup = `${renderIconTile(14, 4, 30, chips[0]!, -5)}${renderIconTile(-6, 28, 32, chips[1]!, -12)}${renderIconTile(26, 32, 30, chips[2]!, 12)}`
  }

  const overflowMarkup =
    payload.overflowCount > 0
      ? renderOverflowDots(32, 62)
      : ''

  // Dynamic Overlay Lighting & Glass Effects
  const overlayEffects = `
    <!-- Top Shine -->
    <path d="M 10 10 L 46 10 Q 51 10 51 15 L 51 25 Q 30 20 10 30 Z" fill="white" fill-opacity="0.15" />
    
    <!-- Border Glow -->
    <rect x="0.5" y="0.5" width="55" height="71" rx="9.5" fill="none" stroke="url(#borderGradient)" stroke-width="1" />
    <linearGradient id="borderGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="white" stop-opacity="0.5" />
      <stop offset="50%" stop-color="white" stop-opacity="0.1" />
      <stop offset="100%" stop-color="white" stop-opacity="0.4" />
    </linearGradient>

    <!-- Overall Soft Light -->
    <rect width="56" height="72" rx="10" fill="url(#lighting)" style="mix-blend-mode: soft-light" />
  `

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="72" viewBox="0 0 56 72" role="img" aria-label="AI Trend Hub thumbnail">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${background.start}" />
          <stop offset="100%" stop-color="${background.end}" />
        </linearGradient>
        
        <linearGradient id="lighting" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="white" stop-opacity="0.3" />
          <stop offset="100%" stop-color="black" stop-opacity="0.15" />
        </linearGradient>

        <filter id="blurFilter">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
        </filter>
      </defs>
      
      <!-- Base Layer -->
      <rect width="56" height="72" rx="10" fill="url(#bg)" />
      
      <!-- Decorative Background Elements (Aesthetic Polish) -->
      <g opacity="0.15">
        ${payload.variant === 'a' 
          ? `
            <circle cx="50" cy="10" r="20" fill="white" />
            <circle cx="5" cy="65" r="15" fill="white" />
          ` 
          : payload.variant === 'b' 
            ? `
              <rect x="-10" y="40" width="40" height="40" rx="20" transform="rotate(-20)" fill="white" />
              <rect x="40" y="-10" width="30" height="30" rx="15" fill="white" />
            ` 
            : `
              <polygon points="0,0 40,0 0,40" fill="white" />
              <circle cx="50" cy="60" r="12" fill="white" />
            `}
      </g>
      
      <!-- Glass Main Card Body -->
      <rect x="3" y="10" width="50" height="54" rx="15" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5" />
      
      <!-- Badge Section -->
      <rect x="5" y="5" width="22" height="13" rx="6.5" fill="white" fill-opacity="0.9" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1))" />
      <text x="16" y="14.5" fill="${background.accent}" font-size="9" font-family="Inter, system-ui, sans-serif" font-weight="900" text-anchor="middle" letter-spacing="-0.5">${badge}</text>
      
      <!-- Tags Layer -->
      <g>
        ${chipMarkup}
      </g>
      
      <!-- Overflow Indicators -->
      ${overflowMarkup}
      
      <!-- Finishing Touches -->
      ${overlayEffects}
      
      <!-- Bottom Decorative Bar -->
      <path d="M 0 62 L 56 62 L 56 72 Q 56 72 56 72 L 0 72 Q 0 72 0 72 Z" fill="rgba(0,0,0,0.08)" />
    </svg>
  `.trim()
}
