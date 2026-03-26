export interface AdjacentTagKeywordReference {
  adjacentTagId: string
  tagKey: string
  displayName: string
  themeKey: string
  priority: number
  keyword: string
  isCaseSensitive: boolean
}

export interface AdjacentTagMatch {
  adjacentTagId: string
  tagKey: string
  displayName: string
  themeKey: string
  priority: number
  sortOrder: number
  score: number
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function matchAdjacentTagsFromKeywords(
  keywords: AdjacentTagKeywordReference[],
  title: string,
  summary: string,
  maxTags = 2,
): AdjacentTagMatch[] {
  const normalizedTitle = normalizeSpaces(title)
  const normalizedSummary = normalizeSpaces(summary)
  const text = `${normalizedTitle}\n${normalizedSummary}`
  const lowerText = text.toLowerCase()

  type Bucket = {
    adjacentTagId: string
    tagKey: string
    displayName: string
    themeKey: string
    priority: number
    score: number
    firstIndex: number
    matched: Set<string>
  }

  const buckets = new Map<string, Bucket>()

  for (const keywordRef of keywords) {
    const haystack = keywordRef.isCaseSensitive ? text : lowerText
    const needle = keywordRef.isCaseSensitive ? keywordRef.keyword : keywordRef.keyword.toLowerCase()
    if (needle.length < 2) continue
    const index = haystack.indexOf(needle)
    if (index < 0) continue

    const current = buckets.get(keywordRef.adjacentTagId) ?? {
      adjacentTagId: keywordRef.adjacentTagId,
      tagKey: keywordRef.tagKey,
      displayName: keywordRef.displayName,
      themeKey: keywordRef.themeKey,
      priority: keywordRef.priority,
      score: 0,
      firstIndex: Number.POSITIVE_INFINITY,
      matched: new Set<string>(),
    }
    if (!current.matched.has(needle)) {
      const proximityBoost = Math.max(0, 14 - Math.floor(index / 70))
      current.score += 10 + proximityBoost
      current.matched.add(needle)
    }
    current.firstIndex = Math.min(current.firstIndex, index)
    buckets.set(keywordRef.adjacentTagId, current)
  }

  return [...buckets.values()]
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score
      if (left.firstIndex !== right.firstIndex) return left.firstIndex - right.firstIndex
      if (left.priority !== right.priority) return left.priority - right.priority
      return left.tagKey.localeCompare(right.tagKey)
    })
    .slice(0, Math.max(1, Math.min(2, maxTags)))
    .map((bucket, index) => ({
      adjacentTagId: bucket.adjacentTagId,
      tagKey: bucket.tagKey,
      displayName: bucket.displayName,
      themeKey: bucket.themeKey,
      priority: bucket.priority,
      sortOrder: index,
      score: bucket.score,
    }))
}

export function resolveThumbnailBgTheme(matches: AdjacentTagMatch[]): string | null {
  if (matches.length === 0) return null
  return matches[0].themeKey
}
