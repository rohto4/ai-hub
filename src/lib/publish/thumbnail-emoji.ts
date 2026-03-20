const EMOJI_RULES: Array<{ emoji: string; patterns: RegExp[] }> = [
  { emoji: '🤖', patterns: [/agent/i, /assistant/i, /autonomous/i, /multi-agent/i, /エージェント/, /自律/] },
  { emoji: '🧠', patterns: [/llm/i, /language model/i, /gpt/i, /claude/i, /gemini/i, /transformer/i, /モデル/] },
  { emoji: '🔬', patterns: [/paper/i, /research/i, /benchmark/i, /arxiv/i, /study/i, /論文/, /研究/, /ベンチマーク/] },
  { emoji: '🛡️', patterns: [/security/i, /safety/i, /guardrail/i, /prompt injection/i, /red team/i, /脆弱/, /安全/, /セキュリティ/] },
  { emoji: '🎙️', patterns: [/voice/i, /speech/i, /audio/i, /podcast/i, /音声/, /会話/] },
  { emoji: '🖼️', patterns: [/image/i, /video/i, /vision/i, /sora/i, /生成画像/, /動画/, /映像/] },
  { emoji: '💻', patterns: [/code/i, /coding/i, /developer/i, /copilot/i, /codex/i, /コーディング/, /開発/] },
  { emoji: '📜', patterns: [/policy/i, /regulation/i, /law/i, /governance/i, /政策/, /規制/, /法/] },
  { emoji: '💼', patterns: [/enterprise/i, /business/i, /bank/i, /customer/i, /導入/, /企業/, /業務/] },
  { emoji: '🛰️', patterns: [/search/i, /retrieval/i, /rag/i, /vector/i, /検索/, /検索拡張/] },
]

const FALLBACK_EMOJIS: Record<string, string[]> = {
  official: ['🤖', '💡', '🔬', '⚡', '🌐', '🔮', '📡', '⚙️', '🛰️', '🔵'],
  alerts: ['🔔', '📢', '📣', '🚨', '🔍', '🚀', '🌟', '🔥', '💬', '⚡'],
  blog: ['✍️', '💭', '🧩', '🎯', '🏆', '💫', '🎨', '🔑', '🌱', '🖊️'],
  paper: ['📄', '🔬', '🧬', '📊', '🔭', '🎓', '🧪', '📐', '🔢', '🌍'],
  news: ['📰', '🗞️', '📡', '🌍', '💼', '📈', '🎙️', '📻', '🏛️', '🌐'],
  video: ['🎬', '🎥', '📹', '🎞️', '🎦', '🎭', '📺', '🖥️', '🎪', '🎬'],
}

const BLAND_EMOJI = new Set(['🧠', '📝', ''])

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim()
}

export function pickThumbnailEmoji(input: {
  title: string
  summary100?: string | null
  summary200?: string | null
  sourceType?: string | null
  sourceCategory?: string | null
}): string {
  if (input.sourceType === 'paper') {
    return '🔬'
  }

  const text = [
    normalize(input.title),
    normalize(input.summary100),
    normalize(input.summary200),
    normalize(input.sourceType),
    normalize(input.sourceCategory),
  ]
    .filter(Boolean)
    .join('\n')

  for (const rule of EMOJI_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.emoji
    }
  }

  return '📝'
}

export function resolveThumbnailEmoji(input: {
  id: string
  sourceType: string
  thumbnailEmoji?: string | null
}): string {
  if (input.thumbnailEmoji && !BLAND_EMOJI.has(input.thumbnailEmoji)) {
    return input.thumbnailEmoji
  }

  const emojis = FALLBACK_EMOJIS[input.sourceType] ?? ['📰', '🔬', '💡', '🌐', '🔔']
  const hash = input.id.split('').reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) >>> 0), 0)
  return emojis[hash % emojis.length]
}
