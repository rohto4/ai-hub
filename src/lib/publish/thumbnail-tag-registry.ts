export type ThumbnailTagRegistryEntry = {
  accentColor: string
  iconPath?: string
  highQualityAssetPath?: string
}

const REGISTRY: Record<string, ThumbnailTagRegistryEntry> = {
  'gpt-5': { accentColor: '#111827', iconPath: '/thumbs/icons/gpt.svg', highQualityAssetPath: '/thumbs/assets/gpt-5.png' },
  chatgpt: { accentColor: '#111827', iconPath: '/thumbs/icons/gpt.svg', highQualityAssetPath: '/thumbs/assets/chatgpt.png' },
  openai: { accentColor: '#0f766e', iconPath: '/thumbs/icons/openai.svg', highQualityAssetPath: '/thumbs/assets/openai.png' },
  gemini: { accentColor: '#2563eb', iconPath: '/thumbs/icons/gemini.svg', highQualityAssetPath: '/thumbs/assets/gemini.png' },
  claude: { accentColor: '#b45309', iconPath: '/thumbs/icons/claude.svg', highQualityAssetPath: '/thumbs/assets/claude.png' },
  anthropic: { accentColor: '#92400e', iconPath: '/thumbs/icons/anthropic.svg', highQualityAssetPath: '/thumbs/assets/anthropic.png' },
  google: { accentColor: '#1d4ed8', iconPath: '/thumbs/icons/google.svg', highQualityAssetPath: '/thumbs/assets/google-ai.png' },
  'google-ai': { accentColor: '#1d4ed8', iconPath: '/thumbs/icons/google.svg', highQualityAssetPath: '/thumbs/assets/google-ai.png' },
  llama: { accentColor: '#7c3aed', iconPath: '/thumbs/icons/llama.svg', highQualityAssetPath: '/thumbs/assets/llama.png' },
  cursor: { accentColor: '#475569', iconPath: '/thumbs/icons/cursor.svg' },
  rag: { accentColor: '#047857', iconPath: '/thumbs/icons/rag.svg', highQualityAssetPath: '/thumbs/assets/rag.png' },
  agent: { accentColor: '#dc2626', iconPath: '/thumbs/icons/agent.svg', highQualityAssetPath: '/thumbs/assets/agent.png' },
  'coding-ai': { accentColor: '#7c2d12', iconPath: '/thumbs/icons/code.svg', highQualityAssetPath: '/thumbs/assets/coding-ai.png' },
  safety: { accentColor: '#1e3a8a', iconPath: '/thumbs/icons/safety.svg', highQualityAssetPath: '/thumbs/assets/safety.png' },
  policy: { accentColor: '#4338ca', iconPath: '/thumbs/icons/policy.svg' },
  'voice-ai': { accentColor: '#be185d', iconPath: '/thumbs/icons/voice.svg' },
  paper: { accentColor: '#0f172a', iconPath: '/thumbs/icons/paper.svg', highQualityAssetPath: '/thumbs/assets/paper.png' },
  llm: { accentColor: '#0369a1', highQualityAssetPath: '/thumbs/assets/llm.png' },
  huggingface: { accentColor: '#d97706', highQualityAssetPath: '/thumbs/assets/huggingface.png' },
  nvidia: { accentColor: '#15803d', highQualityAssetPath: '/thumbs/assets/nvidia.png' },
}

function normalizeTagKey(tagKey: string): string {
  return tagKey.trim().toLowerCase()
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function resolveThumbnailTagRegistryEntry(tagKey: string): ThumbnailTagRegistryEntry | null {
  const normalized = normalizeTagKey(tagKey)
  if (REGISTRY[normalized]) {
    return REGISTRY[normalized]
  }

  const hue = hashString(normalized) % 360
  return {
    accentColor: `hsl(${hue} 60% 42%)`,
  }
}

export function hasThumbnailTagRegistryEntry(tagKey: string): boolean {
  return REGISTRY[normalizeTagKey(tagKey)] !== undefined
}

export function listThumbnailTagRegistryKeys(): string[] {
  return Object.keys(REGISTRY)
}

export function listThumbnailPendingTagKeys(tagKeys: string[]): string[] {
  return [...new Set(tagKeys.map(normalizeTagKey).filter((tagKey) => REGISTRY[tagKey] === undefined))]
}
