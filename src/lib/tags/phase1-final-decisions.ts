export type Phase1DecisionItem = {
  key: string
  label: string
}

export type Phase1FinalDecisions = {
  currentTags: {
    moveToCategory: Phase1DecisionItem[]
    deprecate: Phase1DecisionItem[]
  }
  newTagCandidates: {
    adoptAsPrimaryTags: Phase1DecisionItem[]
    reject: Phase1DecisionItem[]
    hold: Phase1DecisionItem[]
  }
}

export type Phase1TagDecisionPlan = {
  adoptedPrimaryTags: Array<{
    sourceKey: string
    normalizedKey: string
    displayName: string
    keywords: string[]
  }>
  deactivateComparableKeys: string[]
  rejectedCandidateKeys: string[]
  holdCandidateKeys: string[]
}

export function normalizePhase1DecisionTagKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function toComparablePhase1DecisionToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

export function buildPhase1TagDecisionPlan(
  decisions: Phase1FinalDecisions,
): Phase1TagDecisionPlan {
  const adoptedPrimaryTags = decisions.newTagCandidates.adoptAsPrimaryTags.map((item) => ({
    sourceKey: item.key,
    normalizedKey: normalizePhase1DecisionTagKey(item.key),
    displayName: item.label.trim(),
    keywords: uniqueNonEmpty([item.key, item.label]),
  }))

  const deactivateComparableKeys = [
    ...decisions.currentTags.deprecate.map((item) => item.key),
    ...decisions.currentTags.moveToCategory.map((item) => item.key),
  ].map(toComparablePhase1DecisionToken)

  return {
    adoptedPrimaryTags,
    deactivateComparableKeys: Array.from(new Set(deactivateComparableKeys)),
    rejectedCandidateKeys: decisions.newTagCandidates.reject.map((item) => item.key),
    holdCandidateKeys: decisions.newTagCandidates.hold.map((item) => item.key),
  }
}
