import { decodeAndNormalizeText } from '@/lib/text/normalize'

interface RelevanceRule {
  primaryKeywords: string[]
  supportingTitleKeywords?: string[]
  negativeKeywords?: string[]
}

const COMMON_AI_TITLE_HINTS = [
  'ai',
  'model',
  'models',
  'llm',
  'assistant',
  'agent',
  'agents',
  'agentic',
  'voice',
  'speech',
  'prompt',
  'prompts',
  'retrieval',
  'vector',
  'search',
  'governance',
  'safety',
  'policy',
  'evaluation',
  'automation',
]

const RELEVANCE_RULES: Record<string, RelevanceRule> = {
  'google-alerts-voice-ai-voice-agent': {
    primaryKeywords: ['voice ai', 'voice agent', 'voice assistant', 'speech to speech', 'audio ai'],
  },
  'google-alerts-ai-agents-coding-agents': {
    primaryKeywords: ['ai agent', 'ai agents', 'agentic ai', 'coding agent', 'coding agents', 'agentic'],
  },
  'google-alerts-ai-regulation-policy': {
    primaryKeywords: ['ai regulation', 'ai policy', 'ai act', 'ai governance', 'ai law', 'governance'],
  },
  'google-alerts-ai-safety-alignment': {
    primaryKeywords: ['ai safety', 'model safety', 'llm safety', 'ai alignment', 'red teaming', 'ai evaluation'],
  },
  'google-alerts-anthropic-claude-cowork': {
    primaryKeywords: ['anthropic', 'claude', 'cowork'],
    supportingTitleKeywords: ['anthropic', 'claude', 'ai', 'model'],
  },
  'google-alerts-antigravity': {
    primaryKeywords: ['antigravity'],
    supportingTitleKeywords: ['google', 'gemini', 'claude', 'codex', 'ai pro', 'ai ultra'],
    negativeKeywords: ['dji', 'avata', 'drone'],
  },
  'google-alerts-gemini-google-ai-studio': {
    primaryKeywords: ['gemini', 'google ai studio'],
    supportingTitleKeywords: ['gemini', 'google', 'maps', 'studio', 'ai'],
  },
  'google-alerts-openai-chatgpt-codex': {
    primaryKeywords: ['openai', 'chatgpt', 'codex', 'gpt'],
    supportingTitleKeywords: ['openai', 'chatgpt', 'codex', 'gpt', 'ai'],
  },
  'google-alerts-rag-retrieval-augmented-generation': {
    primaryKeywords: ['rag', 'retrieval augmented generation', 'retrieval-augmented generation', 'vector search'],
    supportingTitleKeywords: ['rag', 'retrieval', 'vector', 'embedding', 'search'],
  },
}

export interface RelevanceResult {
  isRelevant: boolean
  matchedKeyword: string | null
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

export function assessSourceTargetRelevance(
  sourceKey: string,
  title: string,
  snippet: string,
): RelevanceResult {
  const rule = RELEVANCE_RULES[sourceKey]
  if (!rule || rule.primaryKeywords.length === 0) {
    return { isRelevant: true, matchedKeyword: null }
  }

  const normalizedTitle = decodeAndNormalizeText(title).toLowerCase()
  const normalizedSnippet = decodeAndNormalizeText(snippet).toLowerCase()
  const supportingKeywords = Array.from(
    new Set([...(rule.supportingTitleKeywords ?? []), ...COMMON_AI_TITLE_HINTS]),
  )

  if (rule.negativeKeywords && includesAny(`${normalizedTitle}\n${normalizedSnippet}`, rule.negativeKeywords)) {
    return { isRelevant: false, matchedKeyword: null }
  }

  const titleMatch = rule.primaryKeywords.find((keyword) => normalizedTitle.includes(keyword)) ?? null
  if (titleMatch) {
    return {
      isRelevant: true,
      matchedKeyword: titleMatch,
    }
  }

  const snippetMatch = rule.primaryKeywords.find((keyword) => normalizedSnippet.includes(keyword)) ?? null
  if (!snippetMatch) {
    return {
      isRelevant: false,
      matchedKeyword: null,
    }
  }

  return {
    isRelevant: includesAny(normalizedTitle, supportingKeywords),
    matchedKeyword: includesAny(normalizedTitle, supportingKeywords) ? snippetMatch : null,
  }
}
