type ThumbnailTagRegistryEntry = {
  shortLabel: string
  accentColor: string
  accentTextColor?: string
}

const REGISTRY: Record<string, ThumbnailTagRegistryEntry> = {
  'gpt-5': { shortLabel: 'GPT', accentColor: '#111827', accentTextColor: '#ffffff' },
  chatgpt: { shortLabel: 'GPT', accentColor: '#111827', accentTextColor: '#ffffff' },
  openai: { shortLabel: 'OPENAI', accentColor: '#0f766e', accentTextColor: '#ffffff' },
  gemini: { shortLabel: 'GEMINI', accentColor: '#2563eb', accentTextColor: '#ffffff' },
  claude: { shortLabel: 'CLAUDE', accentColor: '#b45309', accentTextColor: '#ffffff' },
  anthropic: { shortLabel: 'ANTHROPIC', accentColor: '#92400e', accentTextColor: '#ffffff' },
  google: { shortLabel: 'GOOGLE', accentColor: '#1d4ed8', accentTextColor: '#ffffff' },
  'google-ai': { shortLabel: 'GOOGLE', accentColor: '#1d4ed8', accentTextColor: '#ffffff' },
  llama: { shortLabel: 'LLAMA', accentColor: '#7c3aed', accentTextColor: '#ffffff' },
  cursor: { shortLabel: 'CURSOR', accentColor: '#475569', accentTextColor: '#ffffff' },
  rag: { shortLabel: 'RAG', accentColor: '#047857', accentTextColor: '#ffffff' },
  agent: { shortLabel: 'AGENT', accentColor: '#dc2626', accentTextColor: '#ffffff' },
  'coding-ai': { shortLabel: 'CODE', accentColor: '#7c2d12', accentTextColor: '#ffffff' },
  safety: { shortLabel: 'SAFE', accentColor: '#1e3a8a', accentTextColor: '#ffffff' },
  policy: { shortLabel: 'POLICY', accentColor: '#4338ca', accentTextColor: '#ffffff' },
  'voice-ai': { shortLabel: 'VOICE', accentColor: '#be185d', accentTextColor: '#ffffff' },
  paper: { shortLabel: 'PAPER', accentColor: '#0f172a', accentTextColor: '#ffffff' },
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

function makeShortLabel(tagKey: string): string {
  const tokens = tagKey
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => token.slice(0, token.length <= 4 ? token.length : 3).toUpperCase())

  return tokens.join(' ').slice(0, 10) || tagKey.slice(0, 6).toUpperCase()
}

export function resolveThumbnailTagRegistryEntry(tagKey: string): ThumbnailTagRegistryEntry | null {
  const normalized = normalizeTagKey(tagKey)
  if (REGISTRY[normalized]) {
    return REGISTRY[normalized]
  }

  const hue = hashString(normalized) % 360
  return {
    shortLabel: makeShortLabel(normalized),
    accentColor: `hsl(${hue} 60% 42%)`,
    accentTextColor: '#ffffff',
  }
}

export function hasThumbnailTagRegistryEntry(tagKey: string): boolean {
  return REGISTRY[normalizeTagKey(tagKey)] !== undefined
}

export function listThumbnailTagRegistryKeys(): string[] {
  return Object.keys(REGISTRY)
}
