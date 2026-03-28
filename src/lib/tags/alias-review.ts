export type AliasReviewSourceType =
  | 'current-tag'
  | 'new-tag-candidate'
  | 'current-source-category'
  | 'current-source-type'
  | 'category-candidate'

export type AliasReviewEntry = {
  key: string
  label: string
  sourceType: AliasReviewSourceType
  articleCount?: number
  seenCount?: number
  note?: string
}

export type AliasReviewGroup = {
  comparableKey: string
  heuristics: string[]
  suggestedCanonicalKey: string
  suggestedCanonicalLabel: string
  terms: AliasReviewEntry[]
}

function singularizeToken(token: string): string {
  if (token.length <= 3) {
    return token
  }

  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`
  }

  if (token.endsWith('ses') && token.length > 4) {
    return token.slice(0, -2)
  }

  if (token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1)
  }

  return token
}

function tokenizeAliasValue(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/_-]+/gu, ' ')
    .split(/[\s/_-]+/u)
    .map((token) => token.trim())
    .filter(Boolean)
}

export function normalizeAliasComparableKey(value: string): string {
  return tokenizeAliasValue(value)
    .map((token) => singularizeToken(token))
    .join('')
}

function titleCase(value: string): string {
  return value
    .split(/[\s-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function chooseCanonicalKey(entries: AliasReviewEntry[]): string {
  return [...entries]
    .sort((left, right) => {
      const leftCompact = left.key.replace(/[\s_-]+/g, '').length
      const rightCompact = right.key.replace(/[\s_-]+/g, '').length
      const leftPenalty = left.key.includes(' ') ? 1 : 0
      const rightPenalty = right.key.includes(' ') ? 1 : 0
      const leftScore = (left.articleCount ?? left.seenCount ?? 0)
      const rightScore = (right.articleCount ?? right.seenCount ?? 0)
      return (
        leftPenalty - rightPenalty ||
        rightScore - leftScore ||
        leftCompact - rightCompact ||
        left.key.localeCompare(right.key, 'en')
      )
    })[0]
    .key
}

function collectHeuristics(entries: AliasReviewEntry[]): string[] {
  const lowered = entries.map((entry) => entry.key.toLowerCase())
  const compacted = lowered.map((value) => value.replace(/[\s_-]+/g, ''))
  const singularized = lowered.map(normalizeAliasComparableKey)
  const heuristics = new Set<string>()

  if (new Set(compacted).size === 1 && new Set(lowered).size > 1) {
    heuristics.add('separator-variation')
  }

  if (new Set(singularized).size === 1 && new Set(compacted).size > 1) {
    heuristics.add('pluralization-variation')
  }

  if (new Set(lowered).size === 1 && new Set(entries.map((entry) => entry.key)).size > 1) {
    heuristics.add('case-variation')
  }

  if (heuristics.size === 0) {
    heuristics.add('normalized-match')
  }

  return [...heuristics]
}

export function buildAliasReviewGroups(entries: AliasReviewEntry[]): AliasReviewGroup[] {
  const grouped = new Map<string, AliasReviewEntry[]>()

  for (const entry of entries) {
    const comparableKey = normalizeAliasComparableKey(entry.key)
    if (comparableKey.length < 3) {
      continue
    }
    grouped.set(comparableKey, [...(grouped.get(comparableKey) ?? []), entry])
  }

  return [...grouped.entries()]
    .map(([comparableKey, groupEntries]) => {
      const dedupedEntries = [...groupEntries].sort((left, right) =>
        left.key.localeCompare(right.key, 'en'),
      )
      const uniqueKeys = new Set(dedupedEntries.map((entry) => entry.key))
      if (uniqueKeys.size < 2) {
        return null
      }

      const suggestedCanonicalKey = chooseCanonicalKey(dedupedEntries)
      return {
        comparableKey,
        heuristics: collectHeuristics(dedupedEntries),
        suggestedCanonicalKey,
        suggestedCanonicalLabel: titleCase(suggestedCanonicalKey.replace(/[-_]+/g, ' ')),
        terms: dedupedEntries,
      }
    })
    .filter((group): group is AliasReviewGroup => group !== null)
    .sort((left, right) => {
      const leftScore = Math.max(...left.terms.map((term) => term.articleCount ?? term.seenCount ?? 0))
      const rightScore = Math.max(
        ...right.terms.map((term) => term.articleCount ?? term.seenCount ?? 0),
      )
      return rightScore - leftScore || left.comparableKey.localeCompare(right.comparableKey, 'en')
    })
}
