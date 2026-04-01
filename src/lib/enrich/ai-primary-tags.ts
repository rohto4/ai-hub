import type { TagReference } from '@/lib/tags/match'
import { filterPhase1PrimaryTagMaster } from '@/lib/tags/retag-phase1'

export type AiPrimaryTagOption = {
  tagKey: string
  displayName: string
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export function buildAiPrimaryTagOptions(tagReferences: TagReference[]): AiPrimaryTagOption[] {
  return filterPhase1PrimaryTagMaster(
    tagReferences.map((reference) => ({
      tag_key: reference.tagKey,
      displayName: reference.displayName,
    })),
  ).map((reference) => ({
    tagKey: reference.tag_key,
    displayName: reference.displayName,
  }))
}

export function resolvePrimaryTagIds(params: {
  tagReferences: TagReference[]
  keywordMatchedTagIds: string[]
  aiMatchedTagKeys: string[]
  summaryInputBasis: 'full_content' | 'source_snippet' | 'title_only'
}): string[] {
  const allowedReferences = filterPhase1PrimaryTagMaster(
    params.tagReferences.map((reference) => ({
      id: reference.id,
      tag_key: reference.tagKey,
      displayName: reference.displayName,
    })),
  )
  const allowedIdSet = new Set(allowedReferences.map((reference) => reference.id))
  const referenceByKey = new Map(
    allowedReferences.map((reference) => [reference.tag_key.toLowerCase(), reference]),
  )

  const keywordIds = dedupeStrings(params.keywordMatchedTagIds).filter((tagId) => allowedIdSet.has(tagId))
  if (params.summaryInputBasis !== 'full_content') {
    return keywordIds
  }

  const aiIds = dedupeStrings(params.aiMatchedTagKeys)
    .map((tagKey) => referenceByKey.get(tagKey.toLowerCase())?.id ?? null)
    .filter((tagId): tagId is string => tagId !== null)

  return dedupeStrings([...aiIds, ...keywordIds])
}
