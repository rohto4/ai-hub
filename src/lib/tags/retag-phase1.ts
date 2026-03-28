export const PHASE1_PRIMARY_TAG_EXCLUSION_KEYS = [
  'llm',
  'generative-ai',
  'rag',
  'agent',
  'huggingface',
  'hugging-face',
  'paper',
  'policy',
  'safety',
] as const

export const PHASE1_CATEGORY_CANDIDATE_KEYS = [
  'paper',
  'official',
  'news',
  'search-rag',
  'oss',
  'enterprise-ai',
] as const

function toComparableToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, '')
}

const PHASE1_PRIMARY_TAG_EXCLUSION_TOKENS = new Set(
  PHASE1_PRIMARY_TAG_EXCLUSION_KEYS.map((value) => toComparableToken(value)),
)

export function normalizePhase1CandidateName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function isPhase1ExcludedTagLikeValue(value: string): boolean {
  return PHASE1_PRIMARY_TAG_EXCLUSION_TOKENS.has(toComparableToken(value))
}

export function filterPhase1PrimaryTagMaster<T extends { tag_key: string }>(tags: T[]): T[] {
  return tags.filter((tag) => !isPhase1ExcludedTagLikeValue(tag.tag_key))
}

export function buildPhase1RetagPromptSection(): string {
  return [
    '## Phase 1 Policy',
    '- 1周目はカテゴリ確定ではなく、属性としての全件再構築を目的にする',
    '- primaryTagKeys は固有名詞・製品名・企業名・モデル名・OSS名を優先する',
    '- 抽象タグや分類タグは primaryTagKeys に入れない',
    `- primary から完全除外するタグ: ${PHASE1_PRIMARY_TAG_EXCLUSION_KEYS.join(', ')}`,
    `- 将来カテゴリ候補として観察する値: ${PHASE1_CATEGORY_CANDIDATE_KEYS.join(', ')}`,
    '- proposedPrimaryTags でも除外タグと同義の提案は出さない',
    '- title / summary100 / summary200 の明示的な語だけを根拠にする',
  ].join('\n')
}
