const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'about', 'more',
  'will', 'than', 'over', 'under', 'after', 'before', 'have', 'has', 'had',
  'openai', 'chatgpt', 'claude', 'gemini', 'google', 'anthropic', 'agent',
  'agents', 'model', 'models', 'news', 'update', 'voice', 'policy', 'safety',
  'rag', 'coding', 'code', 'new', 'how', 'why', 'what', 'when', 'using', 'used',
  'announces', 'launches', 'released', 'release', 'latest', 'best', 'ai',
  'asks', 'maps', 'google', 'says', 'reveal', 'reveals', 'show', 'shows', 'gets',
  'chatty', 'power', 'control', 'app', 'apps', 'tool', 'tools', 'platform',
  'report', 'reports', 'real', 'world', 'questions', 'question', 'complex',
  'interactive', 'charts', 'diagrams', 'step', 'steps', 'share', 'used',
  'used', 'within', 'allow', 'allows', 'allowing', 'detailed', 'detail',
  'personal', 'computer', 'visuals', 'strategy', 'raised', 'million', 'cto',
  'would', 'could', 'should', 'your', 'their', 'our', 'his', 'her',
  'search', 'risk', 'risks', 'governance', 'defense', 'pentagon', 'mobile',
  'industry', 'uniformity', 'pilot', 'effort', 'users', 'pricing',
  'building', 'backs', 'coded', 'global', 'former', 'joint',
  'player', 'players', 'bills', 'china', 'chinas', 'buffet', 'lobster',
  'accused', 'murdering',
  'introducing', 'amazon', 'offline', 'chatbots',
])

const GENERIC_PHRASES = new Set([
  'you can',
  'can now',
  'now ask',
  'maps gets',
  'personal computer',
  'sub 700ms',
  'sub 700ms latency',
  'health risks',
  'vector search',
  'antigravity pro',
  'player accused',
  'bills player',
  'accused murdering',
  'china tech',
  'buffet china',
  'lobster buffet',
])

export interface TagReference {
  id: string
  tagKey: string
  displayName: string
  aliases: string[]
}

export interface TagMatchResult {
  matchedTagIds: string[]
  candidateTags: Array<{ candidateKey: string; displayName: string }>
}

export interface TagKeywordReference {
  tagId: string
  keyword: string
  isCaseSensitive: boolean
}

/**
 * tag_keywords テーブルのキーワードで title + summary_200 をマッチングする。
 * daily-enrich の AI 要約生成後に呼び出すことで summary_200 ベースの高精度マッチを実現する。
 * 全文照合より遥かに高速（〜250文字 vs 数千文字）。
 */
export function matchTagsFromKeywords(
  keywords: TagKeywordReference[],
  title: string,
  summary: string,
): string[] {
  const text = `${title} ${summary}`
  const textLower = text.toLowerCase()
  const matchedIds = new Set<string>()

  for (const kw of keywords) {
    const haystack = kw.isCaseSensitive ? text : textLower
    const needle = kw.isCaseSensitive ? kw.keyword : kw.keyword.toLowerCase()
    if (needle.length >= 2 && haystack.includes(needle)) {
      matchedIds.add(kw.tagId)
    }
  }

  return Array.from(matchedIds)
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim()
}


function isCandidateTokenValid(token: string): boolean {
  return token.length >= 3 && !STOPWORDS.has(token)
}

function isCandidatePhraseValid(phrase: string): boolean {
  const parts = phrase.split(' ').filter(Boolean)
  if (parts.length === 0 || parts.length > 3) {
    return false
  }
  if (parts.length === 1 && parts[0].length < 5) {
    return false
  }
  if (!parts.every(isCandidateTokenValid)) {
    return false
  }
  if (GENERIC_PHRASES.has(phrase)) {
    return false
  }
  if (/\d/.test(phrase) && parts.length > 1) {
    return false
  }
  return true
}

/**
 * タイトルから固有名詞候補を抽出する。
 * 固有名詞の判定基準（OR）:
 *   - 全大文字 (NVIDIA, RAG, LLM)
 *   - CamelCase (ChatGPT, LangChain, OpenAI)
 *   - 文頭・副題開始でない位置で大文字始まり (... uses Gemini ...)
 * 文頭とみなす位置: タイトル先頭、または ": " / " - " の直後
 */
function extractProperNounCandidates(title: string): string[] {
  // 文頭インデックスを収集（先頭 + ": " / " – " / " - " 直後）
  const sentenceStartIndices = new Set<number>([0])
  for (const pattern of [':', ' -', ' –', ' —']) {
    let pos = title.indexOf(pattern)
    while (pos !== -1) {
      const afterSep = pos + pattern.length
      // セパレータ後の空白をスキップ
      let wordStart = afterSep
      while (wordStart < title.length && title[wordStart] === ' ') wordStart++
      sentenceStartIndices.add(wordStart)
      pos = title.indexOf(pattern, pos + 1)
    }
  }

  // トークン分割（元の大文字情報を保持）
  const rawTokens: Array<{ original: string; startIndex: number }> = []
  const tokenRegex = /[A-Za-z][A-Za-z0-9-]*/g
  let match: RegExpExecArray | null
  while ((match = tokenRegex.exec(title)) !== null) {
    rawTokens.push({ original: match[0], startIndex: match.index })
  }

  const properNounIndices = new Set<number>()

  for (let i = 0; i < rawTokens.length; i++) {
    const { original, startIndex } = rawTokens[i]
    const lower = original.toLowerCase()

    if (lower.length < 3 || STOPWORDS.has(lower)) continue

    const isAllCaps = /^[A-Z]{2,}[A-Z0-9-]*$/.test(original)             // NVIDIA, GPT-4
    const isCamelCase = /[a-z][A-Z]|[A-Z]{2,}[a-z]/.test(original)       // ChatGPT, LangChain
    const isNonSentenceStart = !sentenceStartIndices.has(startIndex) && /^[A-Z]/.test(original)

    if (isAllCaps || isCamelCase || isNonSentenceStart) {
      properNounIndices.add(i)
    }
  }

  // 単語 ngram（1-gram + 連続する固有名詞の 2-gram）
  const results = new Set<string>()

  for (const i of properNounIndices) {
    const key = rawTokens[i].original.toLowerCase().replace(/-/g, ' ').trim()
    if (isCandidatePhraseValid(key) || key.length >= 3) {
      results.add(key)
    }
    // 隣接する固有名詞との 2-gram
    if (properNounIndices.has(i + 1)) {
      const bigram = `${rawTokens[i].original.toLowerCase()} ${rawTokens[i + 1].original.toLowerCase()}`
      if (isCandidatePhraseValid(bigram)) {
        results.add(bigram)
      }
    }
  }

  return Array.from(results).filter((k) => !GENERIC_PHRASES.has(k))
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function shouldGenerateCandidateTags(title: string): boolean {
  if (!title.trim()) {
    return false
  }

  // Candidate tag mining is currently tuned for Latin-script headlines.
  if (/[^\x00-\x7F]/.test(title)) {
    return false
  }

  return true
}

export function matchTags(
  references: TagReference[],
  title: string,
  content: string,
  sourceCategory?: string,
): TagMatchResult {
  const haystack = normalizeText(`${title}\n${content}`)
  const matchedTagIds = references
    .filter((reference) => {
      const terms = [reference.tagKey, reference.displayName, ...reference.aliases]
      return terms.some((term) => {
        const normalizedTerm = normalizeText(term)
        return normalizedTerm.length >= 2 && haystack.includes(normalizedTerm)
      })
    })
    .map((reference) => reference.id)

  if (sourceCategory) {
    const normalizedCategory = normalizeText(sourceCategory)
    const categoryMatch = references.find((reference) => normalizeText(reference.tagKey) === normalizedCategory)
    if (categoryMatch && !matchedTagIds.includes(categoryMatch.id)) {
      matchedTagIds.push(categoryMatch.id)
    }
  }

  const matchedTerms = new Set(
    references
      .filter((reference) => matchedTagIds.includes(reference.id))
      .flatMap((reference) => [reference.tagKey, reference.displayName, ...reference.aliases].map(normalizeText)),
  )

  const candidateTags = shouldGenerateCandidateTags(title)
    ? extractProperNounCandidates(title)
        .filter((token) => !matchedTerms.has(token))
        .filter((token) => !STOPWORDS.has(token))
        .slice(0, 6)
        .map((token) => ({
          candidateKey: token,
          displayName: titleCase(token),
        }))
    : []

  return {
    matchedTagIds,
    candidateTags,
  }
}
