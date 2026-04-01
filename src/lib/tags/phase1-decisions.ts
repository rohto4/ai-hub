export type Phase1Decision =
  | '採用'
  | '保留'
  | '不採用'
  | '廃止'
  | 'カテゴリ行き'
  | 'タグ行き'

export type Phase1DecisionRow = {
  section: string
  itemType: string
  key: string
  label: string
  suggested: string
  decision: Phase1Decision
  counts: Record<string, boolean | number | string | null>
  note: string
}

export type Phase1AliasDecisionRow = {
  groupId: string
  comparableKey: string
  decision: '廃止'
  recommendedCanonicalKey: string
  terms: string[]
}

type Phase1ManifestItem = {
  key: string
  label: string
  itemType: string
  counts: Record<string, boolean | number | string | null>
  note: string
}

export type Phase1DecisionManifest = {
  generatedAt: string
  source: {
    judgeMarkdown: string
    aliasPolicy: string
  }
  currentTags: {
    keepAsPrimaryTags: Phase1ManifestItem[]
    moveToCategory: Phase1ManifestItem[]
    deprecate: Phase1ManifestItem[]
    hold: Phase1ManifestItem[]
  }
  newTagCandidates: {
    adoptAsPrimaryTags: Phase1ManifestItem[]
    moveToCategory: Phase1ManifestItem[]
    reject: Phase1ManifestItem[]
    hold: Phase1ManifestItem[]
    deprecate: Phase1ManifestItem[]
  }
  currentCategories: {
    keep: Phase1ManifestItem[]
    moveToCategory: Phase1ManifestItem[]
    deprecate: Phase1ManifestItem[]
    hold: Phase1ManifestItem[]
  }
  aliases: {
    deprecate: Phase1AliasDecisionRow[]
  }
}

function parseMarkdownTableLine(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())
}

function isDecision(value: string): value is Phase1Decision {
  return (
    value === '採用' ||
    value === '保留' ||
    value === '不採用' ||
    value === '廃止' ||
    value === 'カテゴリ行き' ||
    value === 'タグ行き'
  )
}

export function parsePhase1DecisionMarkdown(markdown: string): Phase1DecisionRow[] {
  const lines = markdown.split(/\r?\n/u)
  const rows = lines
    .filter((line) => line.startsWith('| '))
    .filter((line) => !line.includes('| --- '))
    .slice(1)

  return rows.map((line) => {
    const [section, itemType, key, label, suggested, decision, counts, note] =
      parseMarkdownTableLine(line)

    if (!isDecision(decision)) {
      throw new Error(`Unknown phase1 decision: ${decision}`)
    }

    return {
      section,
      itemType,
      key,
      label,
      suggested,
      decision,
      counts: counts ? (JSON.parse(counts) as Record<string, boolean | number | string | null>) : {},
      note,
    }
  })
}

function toManifestItem(row: Phase1DecisionRow): Phase1ManifestItem {
  return {
    key: row.key,
    label: row.label,
    itemType: row.itemType,
    counts: row.counts,
    note: row.note,
  }
}

function sortManifestItems(items: Phase1ManifestItem[]): Phase1ManifestItem[] {
  return [...items].sort((left, right) => {
    const leftScore = Number(
      left.counts.articleCount ?? left.counts.seenCount ?? left.counts.publishedArticleCount ?? 0,
    )
    const rightScore = Number(
      right.counts.articleCount ?? right.counts.seenCount ?? right.counts.publishedArticleCount ?? 0,
    )

    return rightScore - leftScore || left.key.localeCompare(right.key, 'en')
  })
}

export function buildPhase1DecisionManifest(input: {
  decisionRows: Phase1DecisionRow[]
  aliasRows: Phase1AliasDecisionRow[]
  judgeMarkdownPath?: string
}): Phase1DecisionManifest {
  const currentTags = input.decisionRows.filter((row) => row.itemType === 'current-tag')
  const newTagCandidates = input.decisionRows.filter((row) => row.itemType === 'new-tag-candidate')
  const currentCategories = input.decisionRows.filter(
    (row) => row.itemType === 'current-source-category' || row.itemType === 'current-source-type',
  )

  return {
    generatedAt: new Date().toISOString(),
    source: {
      judgeMarkdown: input.judgeMarkdownPath ?? '',
      aliasPolicy: 'All alias review groups are deprecated by human decision in this round.',
    },
    currentTags: {
      keepAsPrimaryTags: sortManifestItems(
        currentTags.filter((row) => row.decision === 'タグ行き').map(toManifestItem),
      ),
      moveToCategory: sortManifestItems(
        currentTags.filter((row) => row.decision === 'カテゴリ行き').map(toManifestItem),
      ),
      deprecate: sortManifestItems(
        currentTags.filter((row) => row.decision === '廃止').map(toManifestItem),
      ),
      hold: sortManifestItems(currentTags.filter((row) => row.decision === '保留').map(toManifestItem)),
    },
    newTagCandidates: {
      adoptAsPrimaryTags: sortManifestItems(
        newTagCandidates
          .filter((row) => row.decision === '採用' || row.decision === 'タグ行き')
          .map(toManifestItem),
      ),
      moveToCategory: sortManifestItems(
        newTagCandidates.filter((row) => row.decision === 'カテゴリ行き').map(toManifestItem),
      ),
      reject: sortManifestItems(
        newTagCandidates.filter((row) => row.decision === '不採用').map(toManifestItem),
      ),
      hold: sortManifestItems(
        newTagCandidates.filter((row) => row.decision === '保留').map(toManifestItem),
      ),
      deprecate: sortManifestItems(
        newTagCandidates.filter((row) => row.decision === '廃止').map(toManifestItem),
      ),
    },
    currentCategories: {
      keep: sortManifestItems(
        currentCategories.filter((row) => row.decision === 'カテゴリ行き').map(toManifestItem),
      ),
      moveToCategory: [],
      deprecate: sortManifestItems(
        currentCategories.filter((row) => row.decision === '廃止').map(toManifestItem),
      ),
      hold: sortManifestItems(
        currentCategories.filter((row) => row.decision === '保留').map(toManifestItem),
      ),
    },
    aliases: {
      deprecate: [...input.aliasRows].sort((left, right) =>
        left.groupId.localeCompare(right.groupId, 'en'),
      ),
    },
  }
}
