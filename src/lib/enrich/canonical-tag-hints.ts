import type { TagReference } from '@/lib/tags/match'

export type CanonicalTagRelation = 'alias' | 'keyword'

export type CanonicalTagHint = {
  candidateKey: string
  matchedTagKey: string
  relation: CanonicalTagRelation
  confidence: 'high' | 'medium' | 'low'
}

type AutoCanonicalTagMappings = {
  aliasMappings: Array<{ tagId: string; aliasKey: string }>
  keywordMappings: Array<{ tagId: string; keyword: string }>
}

function normalizeValue(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ')
}

function normalizeComparable(value: string): string {
  return normalizeValue(value).replace(/[\s_-]+/g, '')
}

export function sanitizeCanonicalTagHints(input: unknown): CanonicalTagHint[] {
  if (!Array.isArray(input)) {
    return []
  }

  const seen = new Set<string>()
  const hints: CanonicalTagHint[] = []

  for (const item of input) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const candidateKey = typeof item.candidateKey === 'string'
      ? normalizeValue(item.candidateKey)
      : typeof item.candidate === 'string'
        ? normalizeValue(item.candidate)
        : ''
    const matchedTagKey = typeof item.matchedTagKey === 'string'
      ? normalizeValue(item.matchedTagKey)
      : ''
    const relation = item.relation === 'alias' || item.relation === 'keyword'
      ? item.relation
      : null
    const confidence = item.confidence === 'high' || item.confidence === 'medium' || item.confidence === 'low'
      ? item.confidence
      : null

    if (!candidateKey || !matchedTagKey || !relation || !confidence) {
      continue
    }

    const dedupeKey = `${candidateKey}::${matchedTagKey}::${relation}`
    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)
    hints.push({
      candidateKey,
      matchedTagKey,
      relation,
      confidence,
    })
  }

  return hints
}

export function resolveAutoCanonicalTagMappings(params: {
  tagReferences: TagReference[]
  canonicalTagHints: CanonicalTagHint[]
  summaryInputBasis: 'full_content' | 'source_snippet' | 'title_only'
}): AutoCanonicalTagMappings {
  if (params.summaryInputBasis !== 'full_content') {
    return { aliasMappings: [], keywordMappings: [] }
  }

  const tagByKey = new Map(
    params.tagReferences.map((reference) => [normalizeValue(reference.tagKey), reference]),
  )
  const comparableTerms = new Set(
    params.tagReferences.flatMap((reference) => [
      normalizeComparable(reference.tagKey),
      normalizeComparable(reference.displayName),
      ...reference.aliases.map(normalizeComparable),
    ]),
  )

  const aliasMappings: AutoCanonicalTagMappings['aliasMappings'] = []
  const keywordMappings: AutoCanonicalTagMappings['keywordMappings'] = []
  const seenAliases = new Set<string>()
  const seenKeywords = new Set<string>()

  for (const hint of params.canonicalTagHints) {
    if (hint.confidence !== 'high') {
      continue
    }

    const matchedReference = tagByKey.get(normalizeValue(hint.matchedTagKey))
    if (!matchedReference) {
      continue
    }

    const normalizedCandidate = normalizeValue(hint.candidateKey)
    const comparableCandidate = normalizeComparable(normalizedCandidate)
    if (normalizedCandidate.length < 2 || comparableCandidate.length < 2) {
      continue
    }

    if (
      comparableCandidate === normalizeComparable(matchedReference.tagKey) ||
      comparableCandidate === normalizeComparable(matchedReference.displayName) ||
      matchedReference.aliases.some((alias) => normalizeComparable(alias) === comparableCandidate)
    ) {
      continue
    }

    if (comparableTerms.has(comparableCandidate)) {
      continue
    }

    if (hint.relation === 'alias') {
      const dedupeKey = `${matchedReference.id}::${normalizedCandidate}`
      if (seenAliases.has(dedupeKey)) {
        continue
      }
      seenAliases.add(dedupeKey)
      aliasMappings.push({
        tagId: matchedReference.id,
        aliasKey: normalizedCandidate,
      })
      continue
    }

    const dedupeKey = `${matchedReference.id}::${normalizedCandidate}`
    if (seenKeywords.has(dedupeKey)) {
      continue
    }
    seenKeywords.add(dedupeKey)
    keywordMappings.push({
      tagId: matchedReference.id,
      keyword: normalizedCandidate,
    })
  }

  return {
    aliasMappings,
    keywordMappings,
  }
}
